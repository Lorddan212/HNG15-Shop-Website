import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { adminClient, authClient, databaseConfigured } from './supabase/server';
import { priceCart, ShopError } from './commerce';
import { emailConfigured, sendOrderEmail } from './email';
import type { CartItem, Customer, Delivery, Order, Product } from './types';
export function requireDatabase() { if(!databaseConfigured()) throw new ShopError('The shop is still being connected. Please try again later.',503); }
export async function customer():Promise<Customer|null> {
 if(!databaseConfigured()) return null;
 const {data:{user}}=await (await authClient()).auth.getUser();
 if(!user?.email) return null;
 return {id:user.id,email:user.email,name:user.user_metadata?.full_name || ''};
}
export async function cartToken() {
 const jar=await cookies();let token=jar.get('fv_bag')?.value;
 if(!token || !/^[a-f0-9]{64}$/.test(token)) {
 token=randomBytes(32).toString('hex');
 jar.set('fv_bag',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:60*60*24*30});
 }
 return createHash('sha256').update(token).digest('hex');
}
const orderSelect='*,items:order_items(product_id,product_name,quantity,unit_price_kobo)';
export const repository={
 async products():Promise<Product[]> {
 const {data,error}=await adminClient().from('products').select('*').eq('active',true).order('price_kobo');
 if(error) throw new ShopError('The collection could not be loaded. Try again.',503);return data as Product[];
 },
 async cart(token:string) {
 const {data,error}=await adminClient().from('carts').select('id,cart_items(product_id,quantity,product:products(*))').eq('token_hash',token).maybeSingle();
 if(error) throw new ShopError('Your bag could not be loaded. Try again.',503);
 return priceCart((data?.cart_items || []) as unknown as CartItem[]);
 },
 async changeCart(token:string,input:{product_id:string;quantity:number;operation:string}) {
 const {error}=await adminClient().rpc('change_cart',{p_token_hash:token,p_product_id:input.product_id,p_quantity:input.quantity,p_operation:input.operation});
 if(error) throw new ShopError(error.code==='P0001'?error.message:'Your bag could not be updated.',error.code==='P0001'?409:503);
 return this.cart(token);
 },
 async checkout(token:string,user:Customer,input:Delivery & {request_id:string}) {
 const {request_id,...delivery}=input;
 const {data,error}=await adminClient().rpc('checkout_cart',{p_token_hash:token,p_user_id:user.id,p_email:user.email,p_request_id:request_id,p_delivery:delivery});
 if(error) throw new ShopError(error.code==='P0001'?error.message:'Your order could not be saved. Please retry.',error.code==='P0001'?409:503);
 const order=await this.order(data,user.id);if(!order)throw new ShopError('Order saved. View your orders to check its status.',503);return order;
 },
 async orders(userId:string):Promise<Order[]> {
 const {data,error}=await adminClient().from('orders').select(orderSelect).eq('user_id',userId).order('created_at',{ascending:false}).limit(50);
 if(error)throw new ShopError('Your orders could not be loaded.',503);return data as Order[];
 },
 async order(id:string,userId:string):Promise<Order|null> {
 const {data,error}=await adminClient().from('orders').select(orderSelect).eq('id',id).eq('user_id',userId).maybeSingle();
 if(error)throw new ShopError('This order could not be loaded.',503);return data as Order|null;
 },
 async confirmEmail(order:Order) {
 if(!emailConfigured())return order.email_status;
 const db=adminClient();
 const {data:claimed,error}=await db.rpc('claim_order_email',{p_order_id:order.id});
 if(error||!claimed)return order.email_status;
 try{
 const messageId=await sendOrderEmail(order);
 const {error:saveError}=await db.from('orders').update({email_status:'accepted',mailgun_id:messageId}).eq('id',order.id);
 // If Mailgun accepted but recording failed, retain "sending" to avoid automatic duplicate sends.
 return saveError?'sending' as const:'accepted' as const;
 }catch{
 await db.from('orders').update({email_status:'failed'}).eq('id',order.id);
 return 'failed' as const;
 }
 },
};
