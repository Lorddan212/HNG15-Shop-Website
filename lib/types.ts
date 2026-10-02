export type Product = { id: string; slug: string; name: string; category: 'Notebooks' | 'Planners' | 'Sets'; description: string; price_kobo: number; stock: number; color: string; cover_label: string; subtitle: string; specs: string[] };
export type CartItem = { product_id: string; quantity: number; product: Product };
export type Cart = { items: CartItem[]; subtotal_kobo: number; shipping_kobo: number; total_kobo: number };
export type Delivery = { full_name: string; phone: string; address: string; city: string; state: string; notes: string };
export type OrderItem = { product_name: string; quantity: number; unit_price_kobo: number; product_id: string };
export type Order = Delivery & { id: string; reference: string; user_id: string; email: string; created_at: string; subtotal_kobo: number; shipping_kobo: number; total_kobo: number; payment_method: 'pay_on_delivery'; status: 'placed'; email_status: 'queued' | 'sending' | 'accepted' | 'failed'; items: OrderItem[] };
export type Customer = { id: string; email: string; name: string };
export const EMPTY_CART: Cart = { items: [], subtotal_kobo: 0, shipping_kobo: 0, total_kobo: 0 };
