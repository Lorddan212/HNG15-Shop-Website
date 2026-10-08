import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { createGuestStore, guestCart, type GuestItem } from '@/lib/guest-cart';
import { createCheckoutFlow, type CheckoutResult } from '@/lib/checkout-flow';
import { createCartRealtimeSync, type CartRealtimeClient } from '@/lib/cart-realtime';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { api } from '@/lib/api';
import { signInWithGoogle, completeGoogleSignIn, authErrorMessage } from '@/lib/google-auth';
import { ApiError } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import { EMPTY_CART, type Cart, type CartChange, type Customer, type Delivery, type Product } from '@/lib/types';

type ShopState = {
  products: Product[]; cart: Cart; user: Customer | null; hasSession: boolean; hasGuestItems: boolean;
  loading: boolean; productsLoading: boolean; accountLoading: boolean; refreshing: boolean;
  error: string | null; productError: string | null; accountError: string | null;
  pendingProduct: string | null; signingOut: boolean; signingIn: boolean; authError: string | null;
  googleSignIn: () => Promise<void>; finishGoogleSignIn: (url: string) => Promise<void>;
  refresh: () => Promise<void>; changeCart: (change: CartChange) => Promise<boolean>;
  signOut: () => Promise<void>;
  checkoutDraft: Delivery | undefined; checkingOut: boolean; checkoutPending: boolean; checkoutResult: CheckoutResult | null;
  placeOrder: (delivery: Delivery) => Promise<CheckoutResult>; finishCheckout: () => Promise<void>;
};
const ShopContext = createContext<ShopState | null>(null);
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

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
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [guestItems, setGuestItems] = useState<GuestItem[]>([]);
  const [guestReady, setGuestReady] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);
  const [guestStore] = useState(() => createGuestStore(AsyncStorage));
  const [checkoutFlow] = useState(() => createCheckoutFlow(AsyncStorage, randomUUID, api));
  const realtimeSync = useRef<ReturnType<typeof createCartRealtimeSync>>(null);
  const realtimeStatus = useRef<string>('CLOSED');
  const realtimeError = useRef<unknown>(null);
  const accountFlight = useRef<{ id: string; epoch: number; promise: Promise<void> } | null>(null);
  const authOperations = useRef(0);
  const alive = useRef(false);
  const identity = useRef<string | null>(null);
  const generation = useRef(0);
  const accountRequest = useRef(0);
  const accountNeedsLoad = useRef(false);
  const mutation = useRef(false);
  const refreshLock = useRef(false);

  const acceptSession = useCallback((session: Session | null) => {
    if (!alive.current) return;
    const id = session?.user.id ?? null;
    if (identity.current !== id) {
      if (identity.current) checkoutFlow.forget(identity.current);
      generation.current += 1;
      accountRequest.current += 1;
      identity.current = id;
      setUser(null); setCart(EMPTY_CART); setAccountError(null);
      setCheckoutResult(null); setCheckoutPending(false);
      setAccountLoading(Boolean(id)); setAccountId(id);
    }
    setRestoring(false);
  }, [checkoutFlow]);

  const loadProducts = useCallback(async () => {
    if (!alive.current) return;
    try {
      const next = await api.products();
      if (alive.current) { setProducts(next); setProductError(null); }
    } catch (error) { if (alive.current) setProductError(message(error)); }
    finally { if (alive.current) setProductsLoading(false); }
  }, []);

  const restoreGuest = useCallback(async () => {
    try {
      const items = await guestStore.items();
      if (alive.current) { setGuestItems(items); setGuestReady(true); setGuestError(null); }
    } catch { if (alive.current) setGuestError('Your guest cart could not be restored. Check device storage and try again.'); }
  }, [guestStore]);

  const loadAccount = useCallback(async () => {
    const id = identity.current;
    if (!id || !alive.current) return;
    if (mutation.current) { accountNeedsLoad.current = true; return; }
    accountNeedsLoad.current = false;
    const epoch = generation.current;
    if (accountFlight.current?.id === id && accountFlight.current.epoch === epoch) return accountFlight.current.promise;
    const request = ++accountRequest.current;
    const sameAccount = () => alive.current && epoch === generation.current;
    const current = () => sameAccount() && request === accountRequest.current;
    setAccountLoading(true);
    const promise = (async () => {
      try {
        const [customer, nextCart, pending] = await Promise.all([
          api.customer(id), guestStore.merge(id, api, sameAccount), checkoutFlow.pending(id),
        ]);
        if (current()) {
          setUser(customer); setCart(nextCart); setAccountError(null); setCheckoutPending(pending);
          await restoreGuest();
        }
      } catch (error) {
        if (current()) {
          setAccountError(message(error));
          if (error instanceof ApiError && error.status === 401) { setUser(null); setCart(EMPTY_CART); }
        }
      } finally { if (current()) setAccountLoading(false); }
    })();
    accountFlight.current = { id, epoch, promise };
    try { await promise; }
    finally { if (accountFlight.current?.promise === promise) accountFlight.current = null; }
  }, [guestStore, checkoutFlow, restoreGuest]);

  const reconcileAccountCart = useCallback(async () => {
    const id = identity.current;
    if (!id || !alive.current) return;
    const epoch = generation.current;
    const flight = accountFlight.current;
    if (flight?.id === id && flight.epoch === epoch) await flight.promise;
    if (!alive.current || identity.current !== id || generation.current !== epoch) return;
    const nextCart = await api.cart(id);
    if (alive.current && identity.current === id && generation.current === epoch) setCart(nextCart);
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
    void Promise.resolve().then(restoreGuest);
    const updateRefresh = (state: string) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
        void realtimeSync.current?.reconcileNow();
      } else supabase.auth.stopAutoRefresh();
    };
    const appListener = Platform.OS !== 'web' ? AppState.addEventListener('change', updateRefresh) : null;
    if (Platform.OS !== 'web') updateRefresh(AppState.currentState);
    return () => {
      cancelled = true; alive.current = false; generation.current += 1;
      subscription.unsubscribe(); appListener?.remove();
      if (Platform.OS !== 'web') supabase.auth.stopAutoRefresh();
    };
  }, [acceptSession, loadProducts, restoreGuest]);

  // Outside the auth callback. Each private request obtains the latest token;
  // refreshing that token does not change cart ownership or clear the cart.
  useEffect(() => {
    if (accountId) void Promise.resolve().then(loadAccount);
  }, [accountId, authRevision, loadAccount]);

  useEffect(() => {
    const sync = createCartRealtimeSync({
      client: supabase as unknown as CartRealtimeClient,
      userId: accountId,
      reconcile: reconcileAccountCart,
      onStatus: (status) => {
        realtimeStatus.current = status;
        if (status === 'SUBSCRIBED') realtimeError.current = null;
      },
      onError: (error) => { realtimeError.current = error; },
    });
    realtimeSync.current = sync;
    return () => {
      if (realtimeSync.current === sync) realtimeSync.current = null;
      if (sync) void sync.stop();
    };
  }, [accountId, reconcileAccountCart]);

  const refresh = useCallback(async () => {
    if (refreshLock.current || mutation.current) return;
    refreshLock.current = true; setRefreshing(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      acceptSession(data.session);
      if (alive.current && !data.session) setAccountError(null);
      await Promise.all([loadProducts(), restoreGuest(), loadAccount()]);
    } catch {
      if (alive.current) setAccountError('Your session could not be refreshed. Please try again.');
      await loadProducts();
    } finally { refreshLock.current = false; if (alive.current) setRefreshing(false); }
  }, [acceptSession, loadProducts, loadAccount, restoreGuest]);

  const changeCart = useCallback(async (change: CartChange) => {
    const id = identity.current;
    if (mutation.current || refreshLock.current || accountFlight.current || accountLoading || signingOut || signingIn || !guestReady || (id && accountError)) return false;
    const epoch = generation.current;
    mutation.current = true; setPendingProduct(change.product_id); setAccountError(null);
    const request = ++accountRequest.current;
    try {
      if (!id) {
        const items = await guestStore.change(change, products);
        if (alive.current) { setGuestItems(items); setGuestError(null); }
        return true;
      }
      if (checkoutResult) {
        await checkoutFlow.finish(id);
        if (!alive.current || epoch !== generation.current) return false;
        setCheckoutResult(null); setCheckoutPending(false);
      }
      const next = await api.changeCart(id, change);
      if (!alive.current || epoch !== generation.current) return false;
      if (request === accountRequest.current) setCart(next);
      else await loadAccount();
      return true;
    } catch (error) {
      if (alive.current && epoch === generation.current) setAccountError(message(error));
      return false;
    } finally {
      mutation.current = false;
      if (alive.current) { setPendingProduct(null); if (accountNeedsLoad.current) void loadAccount(); }
    }
  }, [accountLoading, accountError, loadAccount, signingOut, signingIn, guestReady, guestStore, products, checkoutResult, checkoutFlow]);

  const runGoogleAuth = useCallback(async (callbackUrl?: string) => {
    authOperations.current += 1;
    setSigningIn(true); setAuthError(null);
    try {
      if (callbackUrl) await completeGoogleSignIn(callbackUrl);
      else await signInWithGoogle();
      // SIGNED_IN refreshes /api/session and /api/cart through the existing
      // listener. No identity or token is copied from callback URL fields.
    } catch (error) { if (alive.current) setAuthError(authErrorMessage(error)); }
    finally {
      authOperations.current -= 1;
      if (alive.current && authOperations.current === 0) setSigningIn(false);
    }
  }, []);
  const googleSignIn = useCallback(() => runGoogleAuth(), [runGoogleAuth]);
  const finishGoogleSignIn = useCallback((url: string) => runGoogleAuth(url), [runGoogleAuth]);

  const signOut = useCallback(async () => {
    if (!identity.current || signingOut || accountLoading || mutation.current || authOperations.current) return;
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      acceptSession(null); setAuthError(null);
    } catch { if (alive.current) setAccountError('Unable to sign out. Please try again.'); }
    finally { if (alive.current) setSigningOut(false); }
  }, [acceptSession, signingOut, accountLoading]);

  const placeOrder = useCallback(async (delivery: Delivery) => {
    const id = identity.current;
    if (!id) throw new ApiError('Sign in with Google to checkout.', 401);
    if (mutation.current || refreshLock.current || accountFlight.current || accountLoading || accountError || signingOut) throw new Error('Wait for your cart to finish syncing, then try again.');
    if (!cart.items.length && !checkoutPending && !checkoutResult) throw new Error('Your cart is empty. Add an item before checkout.');
    const epoch = generation.current;
    const current = () => alive.current && epoch === generation.current;
    mutation.current = true; accountRequest.current += 1; setCheckingOut(true);
    try {
      const result = await checkoutFlow.place(id, delivery, current);
      if (current()) {
        setCheckoutResult(result); setCheckoutPending(false);
        if (result.cart) setCart(result.cart);
      }
      return result;
    } catch (error) {
      if (current()) setCheckoutPending(await checkoutFlow.pending(id).catch(() => true));
      throw error;
    } finally {
      mutation.current = false;
      if (alive.current) { setCheckingOut(false); if (accountNeedsLoad.current) void loadAccount(); }
    }
  }, [accountLoading, accountError, signingOut, cart.items.length, checkoutPending, checkoutResult, checkoutFlow, loadAccount]);
  const finishCheckout = useCallback(async () => {
    const id = identity.current;
    if (!id) return;
    await checkoutFlow.finish(id);
    if (identity.current === id && alive.current) { setCheckoutResult(null); setCheckoutPending(false); }
  }, [checkoutFlow]);

  return <ShopContext.Provider value={{ products, cart: accountId ? cart : guestCart(guestItems, products), user, hasSession: Boolean(accountId), hasGuestItems: guestItems.some(item => item.quantity > 0),
    loading: restoring || productsLoading, productsLoading, accountLoading: restoring || accountLoading || (!guestReady && !guestError),
    refreshing, productError, accountError: accountError ?? guestError, error: productError ?? accountError ?? guestError,
    pendingProduct, signingOut, signingIn, authError, googleSignIn, finishGoogleSignIn, refresh, changeCart, signOut, checkoutDraft: accountId ? checkoutFlow.draft(accountId) : undefined, checkingOut, checkoutPending, checkoutResult, placeOrder, finishCheckout }}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) throw new Error('useShop must be used inside ShopProvider.');
  return context;
}
