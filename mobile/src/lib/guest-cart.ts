import type { Cart, CartChange, Product } from './types';

export type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };
export type GuestItem = { product_id: string; quantity: number };
type MergeTarget = GuestItem & { guest_quantity: number; attempted: boolean };
type Merge = { userId: string; targets: MergeTarget[]; next: number };
type Saved = { version: 1; items: GuestItem[]; merge: Merge | null };
export const GUEST_CART_KEY = 'foliovale.guest-cart.v1';
const cap = (product: Product) => Math.max(0, Math.min(10, product.stock));
const validItems = (value: unknown): value is GuestItem[] => Array.isArray(value) && value.every(item =>
  item && typeof item.product_id === 'string' && Number.isInteger(item.quantity) && item.quantity >= 0 && item.quantity <= 10)
  && new Set(value.map(item => item.product_id)).size === value.length;

/** Prices are never read from device storage. Refreshing the catalogue reprices this view. */
export function guestCart(items: GuestItem[], products: Product[]): Cart {
  const catalogue = new Map(products.map(product => [product.id, product]));
  const priced = items.flatMap(item => {
    const product = catalogue.get(item.product_id);
    const quantity = product ? Math.min(item.quantity, cap(product)) : 0;
    return product && quantity > 0 ? [{ product_id: product.id, quantity, product }] : [];
  });
  const subtotal_kobo = priced.reduce((sum, item) => sum + item.quantity * item.product.price_kobo, 0);
  const shipping_kobo = subtotal_kobo === 0 || subtotal_kobo >= 3000000 ? 0 : 150000;
  return { items: priced, subtotal_kobo, shipping_kobo, total_kobo: subtotal_kobo + shipping_kobo };
}

export function changeGuest(items: GuestItem[], change: CartChange, products: Product[]): GuestItem[] {
  if (!Number.isInteger(change.quantity) || change.quantity < 0 || change.quantity > 10) throw new Error('Choose a quantity from 0 to 10.');
  const current = guestCart(items, products).items.find(item => item.product_id === change.product_id)?.quantity ?? 0;
  const product = products.find(item => item.id === change.product_id);
  if (change.quantity && !product) throw new Error('This product is no longer available. Refresh the collection.');
  const quantity = product ? Math.min(cap(product), change.operation === 'add' ? current + change.quantity : change.quantity) : 0;
  if (change.quantity && !quantity) throw new Error('This product is sold out.');
  const remaining = items.filter(item => item.product_id !== change.product_id);
  return quantity ? [...remaining, { product_id: change.product_id, quantity }] : remaining;
}

/** A single persisted envelope keeps cart and merge progress together across process restarts. */
export function createGuestStore(storage: Storage) {
  let saved: Saved | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(work: () => Promise<T>): Promise<T> {
    const result = queue.then(work);
    queue = result.catch(() => undefined);
    return result;
  }
  async function read(): Promise<Saved> {
    if (saved) return saved;
    const raw = await storage.getItem(GUEST_CART_KEY);
    if (!raw) return saved = { version: 1, items: [], merge: null };
    try {
      const parsed = JSON.parse(raw) as Saved;
      if (parsed.version !== 1 || !validItems(parsed.items) || (parsed.merge !== null &&
        (!parsed.merge || typeof parsed.merge.userId !== 'string' || !validItems(parsed.merge.targets) ||
          !parsed.merge.targets.every(target => Number.isInteger(target.guest_quantity) && target.guest_quantity > 0 && target.guest_quantity <= 10 && typeof target.attempted === 'boolean') ||
          !Number.isInteger(parsed.merge.next) || parsed.merge.next < 0 || parsed.merge.next > parsed.merge.targets.length))) throw new Error();
      return saved = parsed;
    } catch { throw new Error('Your saved guest cart could not be read. Device storage must be restored before changing it.'); }
  }
  async function save(next: Saved) {
    await storage.setItem(GUEST_CART_KEY, JSON.stringify(next));
    saved = next; // Never acknowledge a mutation before durable storage succeeds.
  }
  return {
    items: () => serial(async () => (await read()).items),
    change: (change: CartChange, products: Product[]) => serial(async () => {
      const state = await read();
      if (state.merge) throw new Error('Sign back in to the previous account to finish saving your guest cart.');
      const items = changeGuest(state.items, change, products);
      await save({ ...state, items });
      return items;
    }),
    merge: (userId: string, api: { cart(id: string): Promise<Cart>; products(): Promise<Product[]>; changeCart(id: string, change: CartChange): Promise<Cart> }, current: () => boolean) => serial(async () => {
      let state = await read();
      const check = () => { if (!current()) throw new Error('Your account changed. Sign in again to finish saving your cart.'); };
      check();
      if (state.merge && state.merge.userId !== userId) throw new Error('Sign back in to the previous account to finish saving your guest cart.');
      let cart = await api.cart(userId);
      if (!state.items.length && !state.merge) return cart;
      const products = await api.products();
      check();
      if (!state.merge) {
        const targets = guestCart(state.items, products).items.map(item => ({ product_id: item.product_id,
          guest_quantity: item.quantity, attempted: false,
          quantity: Math.min(cap(item.product), item.quantity + (cart.items.find(entry => entry.product_id === item.product_id)?.quantity ?? 0)) }));
        state = { ...state, merge: { userId, targets, next: 0 } };
        await save(state); // Journal BEFORE any network write, including the first one.
      }
      let merge = state.merge!;
      while (merge.next < merge.targets.length) {
        check();
        let target = merge.targets[merge.next];
        const product = products.find(item => item.id === target.product_id);
        cart = await api.cart(userId);
        check();
        const existing = cart.items.find(item => item.product_id === target.product_id)?.quantity ?? 0;
        if (!target.attempted) {
          target = { ...target, quantity: product ? Math.min(cap(product), existing + target.guest_quantity) : 0, attempted: true };
          merge = { ...merge, targets: merge.targets.map((item, index) => index === merge.next ? target : item) };
          state = { ...state, merge };
          await save(state);
          check();
        }
        const quantity = product ? Math.min(target.quantity, cap(product)) : 0;
        // Absolute, journaled targets make ambiguous responses safe to retry. Never lower a larger account quantity.
        if (quantity > existing) await api.changeCart(userId, { product_id: target.product_id, quantity, operation: 'set' });
        check();
        merge = { ...merge, next: merge.next + 1 };
        state = { ...state, merge };
        await save(state);
      }
      cart = await api.cart(userId);
      check();
      await save({ version: 1, items: [], merge: null });
      return cart;
    }),
  };
}
