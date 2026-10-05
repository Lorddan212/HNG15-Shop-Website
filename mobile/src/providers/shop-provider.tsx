import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import { EMPTY_CART, type Cart, type CartChange, type Customer, type Product } from '@/lib/types';

type ShopState = {
  products: Product[]; cart: Cart; user: Customer | null; hasSession: boolean;
  loading: boolean; productsLoading: boolean; accountLoading: boolean; refreshing: boolean;
  error: string | null; productError: string | null; accountError: string | null;
  pendingProduct: string | null; signingOut: boolean;
  refresh: () => Promise<void>; changeCart: (change: CartChange) => Promise<boolean>;
  signOut: () => Promise<void>;
};
const ShopContext = createContext<ShopState | null>(null);
const message = (error: unknown) => error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';

export function ShopProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [user, setUser] = useState<Customer | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [authRevision, setAuthRevision] = useState(0);
  const [restoring, setRestoring] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [accountLoading, setAccountLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [pendingProduct, setPendingProduct] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const alive = useRef(false);
  const identity = useRef<string | null>(null);
  const generation = useRef(0);
  const accountRequest = useRef(0);
  const mutation = useRef(false);
  const refreshLock = useRef(false);

  const acceptSession = useCallback((session: Session | null) => {
    if (!alive.current) return;
    const id = session?.user.id ?? null;
    if (identity.current !== id) {
      generation.current += 1;
      accountRequest.current += 1;
      identity.current = id;
      setUser(null); setCart(EMPTY_CART); setAccountError(null);
      setAccountLoading(Boolean(id)); setAccountId(id);
    }
    setRestoring(false);
  }, []);

  const loadProducts = useCallback(async () => {
    if (!alive.current) return;
    try {
      const next = await api.products();
      if (alive.current) { setProducts(next); setProductError(null); }
    } catch (error) { if (alive.current) setProductError(message(error)); }
    finally { if (alive.current) setProductsLoading(false); }
  }, []);

  const loadAccount = useCallback(async () => {
    const id = identity.current;
    if (!id || !alive.current) return;
    const epoch = generation.current;
    const request = ++accountRequest.current;
    const current = () => alive.current && epoch === generation.current && request === accountRequest.current;
    setAccountLoading(true);
    try {
      const [customer, nextCart] = await Promise.all([api.customer(id), api.cart(id)]);
      if (current()) { setUser(customer); setCart(nextCart); setAccountError(null); }
    } catch (error) {
      if (current()) {
        setAccountError(message(error));
        if (error instanceof ApiError && error.status === 401) { setUser(null); setCart(EMPTY_CART); }
      }
    } finally { if (current()) setAccountLoading(false); }
  }, []);

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    let observedAuthEvent = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Stay synchronous: Supabase holds its auth lock during this callback.
      observedAuthEvent = true;
      acceptSession(session);
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') setAuthRevision((revision) => revision + 1);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (cancelled || observedAuthEvent) return;
      if (error) { setAccountError('Your saved session could not be restored. Pull down to retry.'); setRestoring(false); }
      else acceptSession(data.session);
    }).catch(() => {
      if (!cancelled && !observedAuthEvent) { setAccountError('Your saved session could not be restored. Pull down to retry.'); setRestoring(false); }
    });
    // Start network synchronization after listeners have been registered.
    void Promise.resolve().then(loadProducts);
    const updateRefresh = (state: string) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    const appListener = Platform.OS !== 'web' ? AppState.addEventListener('change', updateRefresh) : null;
    if (Platform.OS !== 'web') updateRefresh(AppState.currentState);
    return () => {
      cancelled = true; alive.current = false; generation.current += 1;
      subscription.unsubscribe(); appListener?.remove();
      if (Platform.OS !== 'web') supabase.auth.stopAutoRefresh();
    };
  }, [acceptSession, loadProducts]);

  // Outside the auth callback. Each private request obtains the latest token;
  // refreshing that token does not change cart ownership or clear the cart.
  useEffect(() => {
    if (accountId) void Promise.resolve().then(loadAccount);
  }, [accountId, authRevision, loadAccount]);

  const refresh = useCallback(async () => {
    if (refreshLock.current || mutation.current) return;
    refreshLock.current = true; setRefreshing(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      acceptSession(data.session);
      if (alive.current && !data.session) setAccountError(null);
      await Promise.all([loadProducts(), loadAccount()]);
    } catch {
      if (alive.current) setAccountError('Your session could not be refreshed. Please try again.');
      await loadProducts();
    } finally { refreshLock.current = false; if (alive.current) setRefreshing(false); }
  }, [acceptSession, loadProducts, loadAccount]);

  const changeCart = useCallback(async (change: CartChange) => {
    const id = identity.current;
    if (!id || mutation.current || refreshLock.current || accountLoading || signingOut) return false;
    const epoch = generation.current;
    mutation.current = true; setPendingProduct(change.product_id); setAccountError(null);
    const request = ++accountRequest.current;
    try {
      const next = await api.changeCart(id, change);
      if (!alive.current || epoch !== generation.current) return false;
      if (request === accountRequest.current) setCart(next);
      else await loadAccount();
      return true;
    } catch (error) {
      if (alive.current && epoch === generation.current) setAccountError(message(error));
      return false;
    } finally { mutation.current = false; if (alive.current) setPendingProduct(null); }
  }, [accountLoading, loadAccount, signingOut]);

  const signOut = useCallback(async () => {
    if (!identity.current || signingOut || mutation.current) return;
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      acceptSession(null);
    } catch { if (alive.current) setAccountError('Unable to sign out. Please try again.'); }
    finally { if (alive.current) setSigningOut(false); }
  }, [acceptSession, signingOut]);

  return <ShopContext.Provider value={{ products, cart, user, hasSession: Boolean(accountId),
    loading: restoring || productsLoading, productsLoading, accountLoading: restoring || accountLoading,
    refreshing, productError, accountError, error: productError ?? accountError,
    pendingProduct, signingOut, refresh, changeCart, signOut }}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) throw new Error('useShop must be used inside ShopProvider.');
  return context;
}
