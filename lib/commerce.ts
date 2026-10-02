import { z } from 'zod';
import type { Cart, CartItem } from './types';
export const formatMoney = (kobo: number) => new Intl.NumberFormat('en-NG', { style:'currency', currency:'NGN', maximumFractionDigits:0 }).format(kobo / 100);
export const deliveryFee = (subtotal: number) => subtotal === 0 || subtotal >= 3000000 ? 0 : 150000;
export function priceCart(items: CartItem[]): Cart {
 const subtotal_kobo = items.reduce((sum,item) => sum + item.quantity * item.product.price_kobo, 0);
 const shipping_kobo = deliveryFee(subtotal_kobo);
 return { items, subtotal_kobo, shipping_kobo, total_kobo:subtotal_kobo + shipping_kobo };
}
export const cartSchema = z.object({ product_id:z.string().uuid(), quantity:z.number().int().min(0).max(10), operation:z.enum(['set','add']).default('set') }).strict();
const text = (min:number,max:number) => z.string().trim().min(min).max(max);
export const checkoutSchema = z.object({ request_id:z.string().uuid(), full_name:text(2,100), phone:text(7,25).regex(/^[+\d\s().-]+$/, 'Enter a valid phone number.'), address:text(5,250), city:text(2,80), state:text(2,80), notes:z.string().trim().max(500).default('') }).strict();
export function safeNext(value:string|null) { return value === '/checkout' || value === '/orders' ? value : '/'; }
export function sameOrigin(request:Request) {
 const origin=request.headers.get('origin');if(!origin)return false;
 try {
  const source=new URL(origin),target=new URL(request.url);
  // Next.js can use its internal hostname in request.url. Host retains the browser's destination.
  const host=request.headers.get('host')||target.host;
  return origin===source.origin && source.protocol===target.protocol && source.host===host;
 } catch {return false;}
}
export class ShopError extends Error { constructor(message:string,public status=400) { super(message); } }
