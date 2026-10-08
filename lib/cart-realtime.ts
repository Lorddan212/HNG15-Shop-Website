import type { Cart } from './types';

type Channel = {
  on: (type: 'postgres_changes', config: { event: 'UPDATE'; schema: 'public'; table: 'carts'; filter: string }, callback: (payload: unknown) => void) => Channel;
  subscribe: (callback: (status: string) => void) => Channel;
};
export type CartRealtimeClient = { channel: (name: string) => Channel; removeChannel(channel: Channel): unknown };

/** One queue for every website cart read; local mutations invalidate older snapshots. */
export function createCartReconciler(read: () => Promise<Cart>, apply: (cart: Cart) => void) {
  let stopped = false, queued = false, writes = 0, revision = 0;
  let flight: Promise<void> | null = null;
  function reconcile(): Promise<void> {
    if (stopped) return Promise.resolve();
    queued = true;
    if (flight) return flight;
    if (writes) return Promise.resolve();
    flight = Promise.resolve().then(async () => {
      while (queued && !stopped && !writes) {
        queued = false;
        const started = revision;
        try {
          const cart = await read();
          if (!stopped && !writes && revision === started) apply(cart);
        } catch { /* Keep the last usable cart; subsequent signals/manual refresh retry. */ }
      }
    }).finally(() => { flight = null; if (queued && !writes && !stopped) void reconcile(); });
    return flight;
  }
  return {
    reconcile,
    invalidate() { revision += 1; },
    beginMutation() { writes += 1; revision += 1; },
    endMutation() { writes = Math.max(0, writes - 1); return reconcile(); },
    stop() { stopped = true; queued = false; revision += 1; },
  };
}

/** Payload is deliberately ignored: only the existing API may supply cart contents. */
export function createCartRealtimeSync({ client, userId, reconcile, setTimer = setTimeout, clearTimer = clearTimeout }: {
  client: CartRealtimeClient; userId: string | null; reconcile: () => Promise<void>;
  setTimer?: typeof setTimeout; clearTimer?: typeof clearTimeout;
}) {
  if (!userId) return null;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => { if (!stopped) void reconcile().catch(() => {}); };
  const channel = client.channel('account-cart:' + userId)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'carts', filter: 'user_id=eq.' + userId }, () => {
      if (stopped) return;
      if (timer !== undefined) clearTimer(timer);
      timer = setTimer(() => { timer = undefined; run(); }, 250);
    })
    .subscribe(status => { if (status === 'SUBSCRIBED') run(); });
  return {
    reconcileNow: run,
    stop() {
      if (stopped) return;
      stopped = true;
      if (timer !== undefined) clearTimer(timer);
      try { void Promise.resolve(client.removeChannel(channel)).catch(() => {}); } catch { /* Already disconnected. */ }
    },
  };
}

/** The same queue handles tab return and window focus, with removable listeners. */
export function watchCartActivity(
  page: { visibilityState: string; addEventListener: (name: string, fn: () => void) => void; removeEventListener: (name: string, fn: () => void) => void },
  windowEvents: { addEventListener: (name: string, fn: () => void) => void; removeEventListener: (name: string, fn: () => void) => void },
  reconcile: () => void,
) {
  const active = () => { if (page.visibilityState === 'visible') reconcile(); };
  page.addEventListener('visibilitychange', active);
  windowEvents.addEventListener('focus', active);
  return () => { page.removeEventListener('visibilitychange', active); windowEvents.removeEventListener('focus', active); };
}
