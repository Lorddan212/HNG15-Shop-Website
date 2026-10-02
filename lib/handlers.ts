import { z } from 'zod';
import { cartSchema,checkoutSchema,sameOrigin,ShopError } from './commerce';
import type { Cart, Customer, Delivery, Order, Product } from './types';
export type Services={
 ready:()=>void;user:()=>Promise<Customer|null>;token:()=>Promise<string>;
 products:()=>Promise<Product[]>;cart:(token:string)=>Promise<Cart>;
 changeCart:(token:string,input:z.infer<typeof cartSchema>)=>Promise<Cart>;
 checkout:(token:string,user:Customer,input:Delivery & {request_id:string})=>Promise<Order>;
 orders:(userId:string)=>Promise<Order[]>;order:(id:string,userId:string)=>Promise<Order|null>;
 confirmEmail:(order:Order)=>Promise<Order['email_status']>;
};
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
async function body(request:Request) {
 if(!sameOrigin(request))throw new ShopError('This request was blocked. Reload the page and try again.',403);
 if(!request.headers.get('content-type')?.includes('application/json'))throw new ShopError('Send a JSON request.',415);
 const raw=await request.text();if(raw.length>8000)throw new ShopError('The request is too large.',413);
 try{return JSON.parse(raw);}catch{throw new ShopError('Check the request format.',400);}
}
async function authenticated(s:Services){const user=await s.user();if(!user)throw new ShopError('Sign in with Google to continue.',401);return user;}
export function handlers(s:Services){
 const run=(fn:()=>Promise<unknown>)=>async()=>{
 try{s.ready();return json(await fn());}catch(e){
 if(e instanceof z.ZodError)return json({error:'Check the highlighted information and try again.',fields:e.flatten().fieldErrors},400);
 if(e instanceof ShopError)return json({error:e.message},e.status);
 return json({error:'Something went wrong. Please try again.'},500);
 }};
 return{
 products:()=>run(async()=>({products:await s.products()}))(),
 session:()=>run(async()=>({user:await s.user()}))(),
 cart:()=>run(async()=>({cart:await s.cart(await s.token())}))(),
 changeCart:(request:Request)=>run(async()=>({cart:await s.changeCart(await s.token(),cartSchema.parse(await body(request)))}))(),
 checkout:(request:Request)=>run(async()=>{
 const input=checkoutSchema.parse(await body(request));const user=await authenticated(s);
 const order=await s.checkout(await s.token(),user,input);
 try{order.email_status=await s.confirmEmail(order);}catch{/* A saved order must survive an email outage. */}
 return{order};
 })(),
 orders:()=>run(async()=>({orders:await s.orders((await authenticated(s)).id)}))(),
 order:(id:string)=>run(async()=>{
 if(!z.string().uuid().safeParse(id).success)throw new ShopError('Order not found.',404);
 const order=await s.order(id,(await authenticated(s)).id);if(!order)throw new ShopError('Order not found.',404);return{order};
 })(),
 retryEmail:(request:Request,id:string)=>run(async()=>{
 await body(request);if(!z.string().uuid().safeParse(id).success)throw new ShopError('Order not found.',404);
 const order=await s.order(id,(await authenticated(s)).id);if(!order)throw new ShopError('Order not found.',404);
 const email_status=await s.confirmEmail(order);return{email_status};
 })(),
 };
}
