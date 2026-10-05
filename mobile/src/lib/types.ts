/** Mirrors the existing Next.js JSON contract. All monetary amounts are kobo. */
export type Product = {
  id: string;
  slug: string;
  name: string;
  category: 'Notebooks' | 'Planners' | 'Sets';
  description: string;
  price_kobo: number;
  stock: number;
  color: string;
  cover_label: string;
  subtitle: string;
  specs: string[];
};
export type CartItem = { product_id: string; quantity: number; product: Product };
export type Cart = { items: CartItem[]; subtotal_kobo: number; shipping_kobo: number; total_kobo: number };
export type Customer = { id: string; email: string; name: string };
export type CartChange = { product_id: string; quantity: number; operation: 'set' | 'add' };
export const EMPTY_CART: Cart = { items: [], subtotal_kobo: 0, shipping_kobo: 0, total_kobo: 0 };
