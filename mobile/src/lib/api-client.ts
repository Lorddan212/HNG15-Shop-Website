import type { Cart, CartChange, CheckoutRequest, Customer, Order, Product } from './types';

export class ApiError extends Error {
  constructor(message: string, public readonly status = 0, public readonly fields: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ApiError';
  }
}

type AuthSession = { access_token: string; user: { id: string } };
type Options = {
  baseUrl: string;
  getSession: () => Promise<AuthSession | null>;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

/** No cookie/guest-cart fallback. Only a real session can issue private requests. */
export function createApiClient({ baseUrl, getSession, fetcher = fetch, timeoutMs = 15000 }: Options) {
  async function request<T>(path: string, userId?: string, body?: CartChange | CheckoutRequest): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (userId !== undefined) {
      let session: AuthSession | null;
      try { session = await getSession(); }
      catch { throw new ApiError('Your session could not be restored. Please try again.', 401); }
      if (!session?.access_token || !userId || session.user.id !== userId) {
        throw new ApiError('Please sign in to access your account and cart.', 401);
      }
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    if (body) headers['Content-Type'] = 'application/json';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(`${baseUrl.replace(/\/+$/, '')}${path}`, {
        method: body ? 'POST' : 'GET', headers, credentials: 'omit',
        ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal,
      });
      let payload: unknown;
      try { payload = await response.json(); }
      catch { throw new ApiError('The shop returned an unreadable response. Please try again.', response.status); }
      if (!response.ok) {
        const message = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
          ? payload.error : `The request could not be completed (${response.status}).`;
        throw new ApiError(message, response.status, payload && typeof payload === 'object' && 'fields' in payload && payload.fields && typeof payload.fields === 'object' ? payload.fields as Record<string, string[]> : {});
      }
      if (!payload || typeof payload !== 'object') throw new ApiError('The shop returned an unexpected response.');
      return payload as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(controller.signal.aborted
        ? 'The shop took too long to respond. Please try again.'
        : 'Unable to reach the shop. Check your connection and try again.');
    } finally { clearTimeout(timer); }
  }
  return {
    async products(): Promise<Product[]> {
      const data = await request<{ products: Product[] }>('/api/products');
      if (!Array.isArray(data.products)) throw new ApiError('The product catalogue could not be read.');
      return data.products;
    },
    async customer(userId: string): Promise<Customer> {
      const data = await request<{ user: Customer | null }>('/api/session', userId ?? '');
      if (!data.user || data.user.id !== userId) throw new ApiError('Please sign in again to access your account.', 401);
      return data.user;
    },
    async cart(userId: string): Promise<Cart> {
      const data = await request<{ cart: Cart }>('/api/cart', userId ?? '');
      if (!data.cart || !Array.isArray(data.cart.items)) throw new ApiError('Your cart could not be read.');
      return data.cart;
    },
    async checkout(userId: string, input: CheckoutRequest): Promise<Order> {
      const data = await request<{ order: Order }>('/api/checkout', userId ?? '', input);
      if (!data.order?.id || !data.order.reference || data.order.user_id !== userId || data.order.payment_method !== 'pay_on_delivery') {
        throw new ApiError('The order response could not be verified. Retry this checkout to recover its result.');
      }
      return data.order;
    },
    async changeCart(userId: string, change: CartChange): Promise<Cart> {
      const data = await request<{ cart: Cart }>('/api/cart', userId ?? '', change);
      if (!data.cart || !Array.isArray(data.cart.items)) throw new ApiError('Your cart could not be read. Refresh before trying again.');
      return data.cart;
    },
  };
}
