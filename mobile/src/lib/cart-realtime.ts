type CartChangeConfig = {
  event: 'UPDATE';
  schema: 'public';
  table: 'carts';
  filter: string;
};

export type CartRealtimeChannel = {
  on: (
    type: 'postgres_changes',
    config: CartChangeConfig,
    callback: (payload: unknown) => void,
  ) => CartRealtimeChannel;
  subscribe: (callback: (status: string, error?: unknown) => void) => CartRealtimeChannel;
};

export type CartRealtimeClient = {
  channel: (name: string) => CartRealtimeChannel;
  removeChannel: (channel: CartRealtimeChannel) => Promise<unknown> | unknown;
};

type TimerHandle = ReturnType<typeof setTimeout>;
type CartRealtimeOptions = {
  client: CartRealtimeClient;
  userId: string | null;
  reconcile: () => Promise<void>;
  debounceMs?: number;
  onStatus?: (status: string, error?: unknown) => void;
  onError?: (error: unknown) => void;
  setTimer?: (callback: () => void, delay: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
};

export type CartRealtimeSync = {
  channelName: string;
  filter: string;
  reconcileNow: () => Promise<void>;
  stop: () => Promise<void>;
};

export function createCartRealtimeSync({
  client,
  userId,
  reconcile,
  debounceMs = 250,
  onStatus,
  onError,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}: CartRealtimeOptions): CartRealtimeSync | null {
  if (!userId) return null;

  const channelName = `account-cart:${userId}`;
  const filter = `user_id=eq.${userId}`;
  let stopped = false;
  let timer: TimerHandle | null = null;
  let inFlight: Promise<void> | null = null;
  let queued = false;

  const run = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (inFlight) {
      queued = true;
      return inFlight;
    }

    const promise = Promise.resolve()
      .then(reconcile)
      .catch((error) => { onError?.(error); })
      .finally(() => {
        if (inFlight === promise) inFlight = null;
        if (queued && !stopped) {
          queued = false;
          schedule();
        }
      });
    inFlight = promise;
    return promise;
  };

  const schedule = () => {
    if (stopped) return;
    if (timer) clearTimer(timer);
    timer = setTimer(() => {
      timer = null;
      void run();
    }, debounceMs);
  };

  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'carts', filter },
      () => { schedule(); },
    )
    .subscribe((status, error) => {
      onStatus?.(status, error);
      if (status === 'SUBSCRIBED') void run();
    });

  return {
    channelName,
    filter,
    reconcileNow: run,
    async stop() {
      if (stopped) return;
      stopped = true;
      queued = false;
      if (timer) {
        clearTimer(timer);
        timer = null;
      }
      try { await client.removeChannel(channel); }
      catch (error) { onError?.(error); }
    },
  };
}
