import type { Cart, CheckoutRequest, Delivery, Order } from './types';
import type { Storage } from './guest-cart';

export const deliveryFields = {
  full_name: { label: 'Full name', min: 2, max: 100 },
  phone: { label: 'Phone number', min: 7, max: 25 },
  address: { label: 'Street address', min: 5, max: 250 },
  city: { label: 'City', min: 2, max: 80 },
  state: { label: 'State', min: 2, max: 80 },
  notes: { label: 'Delivery note (optional)', min: 0, max: 500 },
} as const;
export type FieldErrors = Partial<Record<keyof Delivery, string>>;
export function validateDelivery(input: Delivery): { delivery: Delivery; errors: FieldErrors } {
  const delivery = { ...input };
  const errors: FieldErrors = {};
  for (const key of Object.keys(deliveryFields) as (keyof Delivery)[]) {
    delivery[key] = input[key].trim();
    const field = deliveryFields[key];
    if (delivery[key].length < field.min || delivery[key].length > field.max) errors[key] = `${field.label} must be ${field.min}–${field.max} characters.`;
  }
  if (delivery.phone && !/^[+\d\s().-]+$/.test(delivery.phone)) errors.phone = 'Enter a valid phone number.';
  return { delivery, errors };
}
export type CheckoutResult = { order: Order; cart: Cart | null; warning: string | null };
export const checkoutKey = (id: string) => `foliovale.checkout-attempt.v1.${id}`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Keep an attempt across navigation/retries; persist only its UUID, never delivery details. */
export function createCheckoutFlow(storage: Storage, randomUUID: () => string, api: {
  checkout(id: string, input: CheckoutRequest): Promise<Order>; cart(id: string): Promise<Cart>;
}) {
  const attempts = new Map<string, CheckoutRequest>();
  const completed = new Map<string, Order>();
  let flight: { id: string; promise: Promise<CheckoutResult> } | null = null;
  async function run(id: string, input: Delivery, current: () => boolean): Promise<CheckoutResult> {
    const check = () => { if (!current()) throw new Error('Sign in to the same account to recover this checkout.'); };
    check();
    let order = completed.get(id);
    if (!order) {
      let attempt = attempts.get(id);
      if (!attempt) {
        const { delivery, errors } = validateDelivery(input);
        if (Object.keys(errors).length) throw new Error('Check your delivery information and try again.');
        const savedId = await storage.getItem(checkoutKey(id));
        if (savedId && !uuid.test(savedId)) throw new Error('We could not reopen your saved checkout. Please restart the app and try again.');
        attempt = { ...delivery, request_id: savedId ?? randomUUID() };
        await storage.setItem(checkoutKey(id), attempt.request_id);
        attempts.set(id, attempt);
      }
      check();
      try { order = await api.checkout(id, attempt); }
      catch (error) {
        // Definitive validation/stock rejections can be corrected without changing the request UUID.
        if (error && typeof error === 'object' && 'status' in error && (error.status === 400 || error.status === 409)) attempts.delete(id);
        throw error;
      }
      check();
      completed.set(id, order);
    }
    check();
    let warning: string | null = null;
    try { await storage.removeItem(checkoutKey(id)); }
    catch { warning = 'Your order is saved. Try again to finish confirming it.'; }
    let cart: Cart | null = null;
    try {
      cart = await api.cart(id);
      if (cart.items.length) warning = 'Your order is saved, but your cart contains items. Review the cart before placing another order.';
    } catch { warning = 'Your order is saved. Refresh confirmation to check that your cart is cleared.'; }
    check();
    return { order, cart, warning };
  }
  return {
    forget: (id: string) => { attempts.delete(id); completed.delete(id); },
    draft: (id: string): Delivery | undefined => attempts.get(id),
    pending: async (id: string) => Boolean(await storage.getItem(checkoutKey(id))),
    place(id: string, input: Delivery, current: () => boolean) {
      if (!id) return Promise.reject(new Error('Sign in with Google to checkout.'));
      if (flight) return flight.id === id ? flight.promise : Promise.reject(new Error('Another checkout is still finishing.'));
      const promise = run(id, input, current).finally(() => { flight = null; });
      flight = { id, promise };
      return promise;
    },
    async finish(id: string) {
      if (flight) throw new Error('Please wait for checkout to finish.');
      if (!completed.has(id)) throw new Error('Retry your pending checkout before starting another order.');
      await storage.removeItem(checkoutKey(id));
      completed.delete(id); attempts.delete(id);
    },
  };
}
