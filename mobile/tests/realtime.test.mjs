import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

async function load(file) {
  const source = await readFile(new URL(`../src/lib/${file}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const { createCartRealtimeSync } = await load('cart-realtime');

const flush = async () => {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
};

function timers() {
  let next = 1;
  const pending = new Map();
  return {
    setTimer(callback) {
      const handle = next++;
      pending.set(handle, callback);
      return handle;
    },
    clearTimer(handle) { pending.delete(handle); },
    count() { return pending.size; },
    runAll() {
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach(callback => callback());
    },
  };
}

function realtimeClient() {
  const channels = [];
  const removed = [];
  return {
    channels,
    removed,
    channel(name) {
      const channel = {
        name,
        config: null,
        change: null,
        status: null,
        on(type, config, callback) {
          assert.equal(type, 'postgres_changes');
          this.config = config;
          this.change = callback;
          return this;
        },
        subscribe(callback) {
          this.status = callback;
          return this;
        },
      };
      channels.push(channel);
      return channel;
    },
    async removeChannel(channel) { removed.push(channel); },
  };
}

test('guest mode creates no realtime channel', () => {
  const client = realtimeClient();
  const sync = createCartRealtimeSync({ client, userId: null, reconcile: async () => {} });
  assert.equal(sync, null);
  assert.equal(client.channels.length, 0);
});

test('authenticated subscription uses only the owner cart UPDATE filter', () => {
  const client = realtimeClient();
  const sync = createCartRealtimeSync({ client, userId: 'user-a', reconcile: async () => {} });
  assert.equal(client.channels.length, 1);
  assert.equal(client.channels[0].name, 'account-cart:user-a');
  assert.deepEqual(client.channels[0].config, {
    event: 'UPDATE',
    schema: 'public',
    table: 'carts',
    filter: 'user_id=eq.user-a',
  });
  assert.equal(sync.filter, 'user_id=eq.user-a');
});

test('SUBSCRIBED reconciles once and UPDATE events debounce into one refetch', async () => {
  const client = realtimeClient();
  const clock = timers();
  let reads = 0;
  createCartRealtimeSync({
    client,
    userId: 'user-a',
    reconcile: async () => { reads += 1; },
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });
  const channel = client.channels[0];
  channel.status('SUBSCRIBED');
  await flush();
  assert.equal(reads, 1);

  channel.change({});
  channel.change({});
  channel.change({});
  assert.equal(clock.count(), 1);
  clock.runAll();
  await flush();
  assert.equal(reads, 2);
});

test('reconcile guard never runs two account-cart reads simultaneously', async () => {
  const client = realtimeClient();
  const clock = timers();
  let active = 0;
  let maxActive = 0;
  let release;
  let calls = 0;
  const first = new Promise(resolve => { release = resolve; });

  createCartRealtimeSync({
    client,
    userId: 'user-a',
    reconcile: async () => {
      calls += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      if (calls === 1) await first;
      active -= 1;
    },
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  const channel = client.channels[0];
  channel.status('SUBSCRIBED');
  await flush();
  channel.change({});
  clock.runAll();
  await flush();
  assert.equal(calls, 1);

  release();
  await flush();
  assert.equal(clock.count(), 1);
  clock.runAll();
  await flush();
  assert.equal(calls, 2);
  assert.equal(maxActive, 1);
});

test('manual foreground reconciliation shares the same in-flight guard', async () => {
  const client = realtimeClient();
  let release;
  let calls = 0;
  const first = new Promise(resolve => { release = resolve; });

  const sync = createCartRealtimeSync({
    client,
    userId: 'user-a',
    reconcile: async () => {
      calls += 1;
      if (calls === 1) await first;
    },
  });

  const a = sync.reconcileNow();
  const b = sync.reconcileNow();
  await flush();
  assert.equal(calls, 1);
  release();
  await Promise.all([a, b]);
  assert.equal(calls, 1);
});

test('cleanup cancels pending work and removes the old user channel', async () => {
  const client = realtimeClient();
  const clock = timers();
  let reads = 0;

  const sync = createCartRealtimeSync({
    client,
    userId: 'user-a',
    reconcile: async () => { reads += 1; },
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  client.channels[0].change({});
  assert.equal(clock.count(), 1);
  await sync.stop();
  assert.equal(clock.count(), 0);
  assert.deepEqual(client.removed, [client.channels[0]]);
  clock.runAll();
  await flush();
  assert.equal(reads, 0);
});

test('channel statuses are tracked without exposing technical errors to cart state', () => {
  const client = realtimeClient();
  const seen = [];

  createCartRealtimeSync({
    client,
    userId: 'user-a',
    reconcile: async () => {},
    onStatus: (status, error) => { seen.push([status, error]); },
  });

  const failure = new Error('socket');
  client.channels[0].status('CHANNEL_ERROR', failure);
  client.channels[0].status('TIMED_OUT');
  client.channels[0].status('CLOSED');

  assert.deepEqual(seen.map(([status]) => status), ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);
  assert.equal(seen[0][1], failure);
});
