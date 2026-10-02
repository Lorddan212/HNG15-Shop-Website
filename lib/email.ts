import type { Order } from './types';
import { formatMoney } from './commerce';
export function emailConfigured() { return Boolean(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN && process.env.MAILGUN_FROM); }
export function confirmationText(order:Order) {
 return ['FolioVale — order confirmation', '', 'Thank you, '+order.full_name+'.', 'Your order '+order.reference+' has been recorded.', '',
 ...order.items.map(item=>item.quantity+' × '+item.product_name+' — '+formatMoney(item.quantity*item.unit_price_kobo)),
 '', 'Delivery: '+formatMoney(order.shipping_kobo),'Total: '+formatMoney(order.total_kobo),
 'Payment method: Pay on delivery. No online payment was taken.', '', 'Delivery address:',order.address,order.city+', '+order.state,
 '', 'This order was placed during checkout testing. No payment will be collected and no shipment is arranged.'].join('\n');
}
export async function sendOrderEmail(order:Order,fetcher:typeof fetch=fetch) {
 if(!emailConfigured()) throw new Error('Email is not configured');
 const base=process.env.MAILGUN_API_BASE_URL || 'https://api.mailgun.net';
 if(!['https://api.mailgun.net','https://api.eu.mailgun.net'].includes(base)) throw new Error('Invalid Mailgun region');
 const form=new FormData();
 form.set('from',process.env.MAILGUN_FROM!);form.set('to',order.email);form.set('subject','FolioVale order '+order.reference);form.set('text',confirmationText(order));
 const response=await fetcher(base+'/v3/'+encodeURIComponent(process.env.MAILGUN_DOMAIN!)+'/messages',{
 method:'POST',headers:{Authorization:'Basic '+Buffer.from('api:'+process.env.MAILGUN_API_KEY).toString('base64')},body:form,signal:AbortSignal.timeout(15000),
 });
 if(!response.ok) throw new Error('Mailgun did not accept the message');
 const result=await response.json();
 if(typeof result.id!=='string') throw new Error('Invalid Mailgun response');
 return result.id as string;
}
