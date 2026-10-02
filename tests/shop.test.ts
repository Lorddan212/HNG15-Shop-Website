
import test from 'node:test';
import assert from 'node:assert/strict';
import {handlers,type Services} from '../lib/handlers';
import {deliveryFee,priceCart,safeNext,ShopError} from '../lib/commerce';
import {confirmationText,sendOrderEmail} from '../lib/email';
import {previewProducts} from '../lib/catalog';
import {EMPTY_CART,type Order} from '../lib/types';
const id='20000000-0000-4000-8000-000000000001';
const uid='30000000-0000-4000-8000-000000000001';
const user={id:uid,email:'customer@example.com',name:'Test Customer'};
const order:Order={id,reference:'FV-TEST',user_id:uid,email:user.email,created_at:'2026-10-01T10:00:00Z',full_name:'Test Customer',phone:'08012345678',address:'10 Example Street',city:'Lagos',state:'Lagos',notes:'',subtotal_kobo:850000,shipping_kobo:150000,total_kobo:1000000,payment_method:'pay_on_delivery',status:'placed',email_status:'queued',items:[{product_id:previewProducts[0].id,product_name:'The Daybook',quantity:1,unit_price_kobo:850000}]};
const valid={request_id:id,full_name:'Test Customer',phone:'08012345678',address:'10 Example Street',city:'Lagos',state:'Lagos',notes:''};
const services=():Services=>({ready(){},user:async()=>user,token:async()=>'cart-hash',products:async()=>previewProducts,cart:async()=>EMPTY_CART,changeCart:async()=>EMPTY_CART,checkout:async()=>structuredClone(order),orders:async()=>[structuredClone(order)],order:async(_id,owner)=>owner===uid?structuredClone(order):null,confirmEmail:async()=> 'accepted'});
const post=(body:unknown,origin='http://localhost:3000')=>new Request('http://localhost:3000/api/test',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
test('catalogue, session and cart endpoints return data without shared caching',async()=>{
 const api=handlers(services());for(const response of [await api.products(),await api.session(),await api.cart()]){assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');}
});
test('database unavailable returns 503 rather than a pretend success',async()=>{
 const s=services();s.ready=()=>{throw new ShopError('Not connected',503);};assert.equal((await handlers(s).cart()).status,503);
});
test('cart accepts a valid change and rejects negative, fractional and excessive quantities',async()=>{
 const api=handlers(services());assert.equal((await api.changeCart(post({product_id:previewProducts[0].id,quantity:2}))).status,200);
 for(const quantity of [-1,1.5,11])assert.equal((await api.changeCart(post({product_id:previewProducts[0].id,quantity}))).status,400);
});
test('mutations block foreign and missing origins',async()=>{
 const api=handlers(services());assert.equal((await api.checkout(post(valid,'https://attacker.example'))).status,403);
 const request=new Request('http://localhost:3000/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(valid)});assert.equal((await api.checkout(request)).status,403);
});
test('checkout requires verified sign-in',async()=>{const s=services();s.user=async()=>null;assert.equal((await handlers(s).checkout(post(valid))).status,401);});
test('checkout rejects client prices, empty delivery information and invalid phone numbers',async()=>{
 const api=handlers(services());for(const input of [{...valid,total_kobo:1},{...valid,address:''},{...valid,phone:'not-a-phone'}])assert.equal((await api.checkout(post(input))).status,400);
});
test('checkout passes verified identity and returns a persisted order when email fails',async()=>{
 const s=services();s.checkout=async(_token,actualUser,input)=>{assert.equal(actualUser.email,user.email);assert.equal(input.request_id,id);return structuredClone(order);};s.confirmEmail=async()=>{throw Error('Mailgun down');};
 const response=await handlers(s).checkout(post(valid));assert.equal(response.status,200);assert.equal((await response.json()).order.id,id);
});
test('stock conflicts produce 409 without pretending checkout succeeded',async()=>{
 const s=services();s.checkout=async()=>{throw new ShopError('Not enough stock',409);};assert.equal((await handlers(s).checkout(post(valid))).status,409);
});
test('order history and detail require sign-in; other users cannot read an order',async()=>{
 const s=services();let api=handlers(s);assert.equal((await api.orders()).status,200);assert.equal((await api.order(id)).status,200);assert.equal((await api.order('invalid')).status,404);
 s.user=async()=>({...user,id:'40000000-0000-4000-8000-000000000001'});assert.equal((await api.order(id)).status,404);
 s.user=async()=>null;assert.equal((await api.orders()).status,401);assert.equal((await api.order(id)).status,401);
});
test('email retry only applies to the authenticated customer order',async()=>{
 const s=services();const api=handlers(s);assert.equal((await api.retryEmail(post({}),id)).status,200);
 s.user=async()=>({...user,id:'other'});assert.equal((await api.retryEmail(post({}),id)).status,404);
});
test('JSON requests reject malformed and oversized bodies',async()=>{
 const api=handlers(services());
 const req=(body:string)=>new Request('http://localhost:3000/api/cart',{method:'POST',headers:{origin:'http://localhost:3000','content-type':'application/json'},body});
 assert.equal((await api.changeCart(req('{broken'))).status,400);assert.equal((await api.changeCart(req('x'.repeat(8001)))).status,413);
});
test('totals use integer kobo and delivery threshold',()=>{
 assert.equal(deliveryFee(0),0);assert.equal(deliveryFee(2999999),150000);assert.equal(deliveryFee(3000000),0);
 const cart=priceCart([{product_id:previewProducts[0].id,product:previewProducts[0],quantity:2}]);assert.equal(cart.total_kobo,1850000);
});
test('OAuth next destinations cannot redirect outside the shop',()=>{assert.equal(safeNext('https://attacker.example'),'/');assert.equal(safeNext('//attacker.example'),'/');assert.equal(safeNext('/checkout'),'/checkout');});
test('confirmation text uses saved totals and clearly states no payment was taken',()=>{const text=confirmationText(order);assert.match(text,/FV-TEST/);assert.match(text,/No online payment was taken/);assert.match(text,/no shipment is arranged/);});
test('Mailgun sends to the verified order email and handles provider rejection',async()=>{
 const previous={key:process.env.MAILGUN_API_KEY,domain:process.env.MAILGUN_DOMAIN,from:process.env.MAILGUN_FROM,base:process.env.MAILGUN_API_BASE_URL};
 process.env.MAILGUN_API_KEY='test-only';process.env.MAILGUN_DOMAIN='example.test';process.env.MAILGUN_FROM='FolioVale <orders@example.test>';process.env.MAILGUN_API_BASE_URL='https://api.mailgun.net';
 try{
 const fake=async(url:Parameters<typeof fetch>[0],init?:RequestInit)=>{assert.equal(url,'https://api.mailgun.net/v3/example.test/messages');assert.equal((init?.body as FormData).get('to'),user.email);return Response.json({id:'test-message'});};
 assert.equal(await sendOrderEmail(order,fake as typeof fetch),'test-message');
 await assert.rejects(()=>sendOrderEmail(order,(async()=>new Response('rejected',{status:401})) as typeof fetch));
 }finally{for(const[k,v]of Object.entries({MAILGUN_API_KEY:previous.key,MAILGUN_DOMAIN:previous.domain,MAILGUN_FROM:previous.from,MAILGUN_API_BASE_URL:previous.base})){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});


test('same-origin cart writes use the incoming host when Next normalizes its internal URL',async()=>{
 const api=handlers(services());
 const req=(origin:string,host:string,forwarded='')=>new Request('http://localhost:3002/api/cart',{method:'POST',headers:{origin,host,'x-forwarded-host':forwarded,'content-type':'application/json'},body:JSON.stringify({product_id:previewProducts[0].id,quantity:1})});
 assert.equal((await api.changeCart(req('http://127.0.0.1:3002','127.0.0.1:3002'))).status,200);
 assert.equal((await api.changeCart(req('https://127.0.0.1:3002','127.0.0.1:3002'))).status,403);
 assert.equal((await api.changeCart(req('http://attacker.example','127.0.0.1:3002','attacker.example'))).status,403);
 assert.equal((await api.changeCart(req('http://localhost:3002','127.0.0.1:3002'))).status,403);
 assert.equal((await api.changeCart(req('null','127.0.0.1:3002'))).status,403);
});
