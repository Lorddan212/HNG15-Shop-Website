import { z } from 'zod';
import { cartSchema,checkoutSchema,sameOrigin,ShopError } from './commerce';
import type { Cart, Customer, Delivery, Order, Product } from './types';
export type Services={
 ready:()=>void;user:(request?:Request)=>Promise<Customer|null>;token:(user:Customer|null,request?:Request)=>Promise<string>;
 products:()=>Promise<Product[]>;cart:(token:string)=>Promise<Cart>;
 changeCart:(token:string,input:z.infer<typeof cartSchema>)=>Promise<Cart>;
 checkout:(token:string,user:Customer,input:Delivery & {request_id:string})=>Promise<Order>;
 orders:(userId:string)=>Promise<Order[]>;order:(id:string,userId:string)=>Promise<Order|null>;
 deleteOrder:(id:string,userId:string)=>Promise<boolean>;
 confirmEmail:(order:Order)=>Promise<Order['email_status']>;
};
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
async function body(request:Request) {
 if(!request.headers.get('content-type')?.includes('application/json'))throw new ShopError('Send a JSON request.',415);
 const raw=await request.text();if(raw.length>8000)throw new ShopError('The request is too large.',413);
 try{return JSON.parse(raw);}catch{throw new ShopError('Check the request format.',400);}
}
async function authenticated(s:Services,request?:Request){const user=await s.user(request);if(!user)throw new ShopError('Sign in with Google to continue.',401);return user;}
async function mutationUser(s:Services,request:Request){
 if(request.headers.has('authorization')){
  // s.user must verify the token with Supabase before this grants an Origin exemption.
  return authenticated(s,request);
 }
 if(!sameOrigin(request))throw new ShopError('This request was blocked. Reload the page and try again.',403);
 return s.user(request);
}
export function handlers(s:Services){
 const run=(fn:()=>Promise<unknown>)=>async()=>{
 try{s.ready();return json(await fn());}catch(e){
 if(e instanceof z.ZodError)return json({error:'Check the highlighted information and try again.',fields:e.flatten().fieldErrors},400);
 if(e instanceof ShopError)return json({error:e.message},e.status);
 return json({error:'Something went wrong. Please try again.'},500);
 }};
 return{
 products:(request?:Request)=>run(async()=>{if(request?.headers.has('authorization'))await authenticated(s,request);return{products:await s.products()};})(),
 session:(request?:Request)=>run(async()=>({user:await s.user(request)}))(),
 cart:(request?:Request)=>run(async()=>({cart:await s.cart(await s.token(await s.user(request),request))}))(),
 changeCart:(request:Request)=>run(async()=>{
 const user=await mutationUser(s,request);const input=cartSchema.parse(await body(request));
 return{cart:await s.changeCart(await s.token(user,request),input)};
 })(),
 checkout:(request:Request)=>run(async()=>{
 const user=await mutationUser(s,request);const input=checkoutSchema.parse(await body(request));
 if(!user)throw new ShopError('Sign in with Google to continue.',401);
 const order=await s.checkout(await s.token(user,request),user,input);
 try{order.email_status=await s.confirmEmail(order);}catch{/* A saved order must survive an email outage. */}
 return{order};
 })(),
 orders:(request?:Request)=>run(async()=>({orders:await s.orders((await authenticated(s,request)).id)}))(),
 order:(id:string,request?:Request)=>run(async()=>{
 if(request?.headers.has('authorization'))await authenticated(s,request);
 if(!z.string().uuid().safeParse(id).success)throw new ShopError('Order not found.',404);
 const order=await s.order(id,(await authenticated(s,request)).id);if(!order)throw new ShopError('Order not found.',404);return{order};
 })(),
 deleteOrder:(request:Request,id:string)=>run(async()=>{
 const user=await mutationUser(s,request);if(!user)throw new ShopError('Sign in with Google to continue.',401);
 if(!z.string().uuid().safeParse(id).success)throw new ShopError('Order not found.',404);
 if(!await s.deleteOrder(id,user.id))throw new ShopError('Order not found.',404);
 return{deleted:true};
 })(),
 retryEmail:(request:Request,id:string)=>run(async()=>{
 await mutationUser(s,request);await body(request);if(!z.string().uuid().safeParse(id).success)throw new ShopError('Order not found.',404);
 const order=await s.order(id,(await authenticated(s,request)).id);if(!order)throw new ShopError('Order not found.',404);
 const email_status=await s.confirmEmail(order);return{email_status};
 })(),
 };
}
