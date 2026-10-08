import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCartReconciler, createCartRealtimeSync, watchCartActivity, type CartRealtimeClient } from '../lib/cart-realtime';
import { EMPTY_CART, type Cart } from '../lib/types';

type Channel = ReturnType<CartRealtimeClient['channel']>;
function client() {
  const removed: unknown[] = [];
  const channels: { name: string; config?: Parameters<Channel['on']>[1]; change: (p: unknown) => void; status: (s: string) => void }[] = [];
  return {
    removed, channels,
    channel(name: string) {
      const state = { name, change: (_p: unknown) => {}, status: (_s: string) => {}, config: undefined as Parameters<Channel['on']>[1] | undefined };
      const channel: Channel = {
        on(_type, config, callback) { state.config = config; state.change = callback; return channel; },
        subscribe(callback) { state.status = callback; return channel; },
      };
      channels.push(state); return channel;
    },
    removeChannel(channel: Channel) { removed.push(channel); return Promise.resolve(); },
  };
}
function clock() {
  let id = 0;
  const pending = new Map<number, () => void>();
  return {
    setTimer: ((callback: () => void) => { const key = ++id; pending.set(key, callback); return key; }) as unknown as typeof setTimeout,
    clearTimer: ((key: number) => { pending.delete(key); }) as unknown as typeof clearTimeout,
    size: () => pending.size,
    tick: () => { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(fn => fn()); },
  };
}
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const deferred = () => { let resolve!: (cart: Cart) => void; const promise = new Promise<Cart>(r => { resolve = r; }); return { promise, resolve }; };

test('website signed-out state never subscribes', () => {
  const c = client();
  assert.equal(createCartRealtimeSync({ client: c, userId: null, reconcile: async () => {} }), null);
  assert.equal(c.channels.length, 0);
});
test('website channel listens only for UPDATE on its owner-filtered cart metadata', () => {
  const c = client();
  const sync = createCartRealtimeSync({ client: c, userId: 'owner-a', reconcile: async () => {} });
  assert.equal(c.channels[0].name, 'account-cart:owner-a');
  assert.deepEqual(c.channels[0].config, { event: 'UPDATE', schema: 'public', table: 'carts', filter: 'user_id=eq.owner-a' });
  sync?.stop();
});
test('subscription readiness refetches and duplicate notifications debounce without trusting payload', async () => {
  const c = client(), time = clock();
  let reads = 0;
  const applied: Cart[] = [];
  const reconcile = createCartReconciler(async () => { reads++; return EMPTY_CART; }, cart => applied.push(cart));
  const sync = createCartRealtimeSync({ client: c, userId: 'owner-a', reconcile: reconcile.reconcile, ...time });
  c.channels[0].status('SUBSCRIBED'); await flush();
  assert.equal(reads, 1);
  c.channels[0].change({ total_kobo: 99999 }); c.channels[0].change({ items: ['untrusted'] });
  assert.equal(time.size(), 1); assert.equal(reads, 1);
  time.tick(); await flush();
  assert.equal(reads, 2); assert.deepEqual(applied, [EMPTY_CART, EMPTY_CART]);
  sync?.stop(); reconcile.stop();
});
test('overlapping signals queue exactly one follow-up cart read', async () => {
  const first = deferred();
  let reads = 0, active = 0, peak = 0;
  const reconcile = createCartReconciler(async () => {
    reads++; active++; peak = Math.max(peak, active);
    const result = reads === 1 ? await first.promise : EMPTY_CART;
    active--; return result;
  }, () => {});
  const initial = reconcile.reconcile();
  await flush();
  void reconcile.reconcile(); void reconcile.reconcile(); void reconcile.reconcile();
  assert.equal(reads, 1);
  first.resolve(EMPTY_CART); await initial;
  assert.equal(reads, 2); assert.equal(peak, 1);
  reconcile.stop();
});
test('a pre-mutation cart response cannot overwrite the immediate mutation result', async () => {
  const old = deferred();
  const fresh = { ...EMPTY_CART, total_kobo: 123 };
  let count = 0;
  const applied: Cart[] = [];
  const reconcile = createCartReconciler(async () => ++count === 1 ? old.promise : fresh, cart => applied.push(cart));
  const flight = reconcile.reconcile(); await flush();
  reconcile.beginMutation();
  void reconcile.reconcile();
  old.resolve(EMPTY_CART); await flight;
  assert.equal(applied.length, 0);
  assert.equal(count, 1);
  // The provider applies its POST result immediately; only a later GET can reconcile it.
  applied.push(fresh);
  await reconcile.endMutation();
  assert.deepEqual(applied, [fresh, fresh]);
  reconcile.stop();
});
test('identity invalidation discards old account responses and refetches the new cart serially', async () => {
  const old = deferred(); let reads = 0; const applied: Cart[] = [];
  const next = { ...EMPTY_CART, total_kobo: 321 };
  const reconcile = createCartReconciler(async () => ++reads === 1 ? old.promise : next, cart => applied.push(cart));
  const flight = reconcile.reconcile(); await flush();
  reconcile.invalidate(); void reconcile.reconcile();
  old.resolve(EMPTY_CART); await flight;
  assert.deepEqual(applied, [next]); reconcile.stop();
});
test('cleanup removes the channel once and cancels notifications, including late readiness', async () => {
  const c = client(), time = clock(); let reads = 0;
  const sync = createCartRealtimeSync({ client: c, userId: 'owner-a', reconcile: async () => { reads++; }, ...time });
  c.channels[0].change({});
  sync?.stop(); sync?.stop();
  c.channels[0].change({}); c.channels[0].status('SUBSCRIBED'); time.tick(); await flush();
  assert.equal(time.size(), 0); assert.equal(reads, 0); assert.equal(c.removed.length, 1);
});
test('stopping reconciliation ignores in-flight responses and queued work', async () => {
  const gate = deferred(); let applied = 0, reads = 0;
  const reconcile = createCartReconciler(async () => { reads++; return gate.promise; }, () => { applied++; });
  const flight = reconcile.reconcile(); await flush();
  void reconcile.reconcile(); reconcile.stop(); gate.resolve(EMPTY_CART); await flight;
  await reconcile.reconcile(); assert.equal(applied, 0); assert.equal(reads, 1);
});
test('failed cart reads preserve the view and ordinary refresh can recover', async () => {
  let count = 0, applied = 0;
  const reconcile = createCartReconciler(async () => { if (++count === 1) throw new Error('offline'); return EMPTY_CART; }, () => { applied++; });
  await reconcile.reconcile(); assert.equal(applied, 0);
  await reconcile.reconcile(); assert.equal(applied, 1); reconcile.stop();
});
test('browser activity reconciles visible tabs and removes all listeners on cleanup', () => {
  const handlers = new Map<string, () => void>();
  const page = { visibilityState: 'hidden', addEventListener: (key: string, fn: () => void) => { handlers.set(key, fn); }, removeEventListener: (key: string) => { handlers.delete(key); } };
  let reads = 0;
  const stop = watchCartActivity(page, page, () => { reads++; });
  handlers.get('visibilitychange')?.(); assert.equal(reads, 0);
  page.visibilityState = 'visible';
  handlers.get('visibilitychange')?.(); handlers.get('focus')?.(); assert.equal(reads, 2);
  stop(); assert.equal(handlers.size, 0);
});
