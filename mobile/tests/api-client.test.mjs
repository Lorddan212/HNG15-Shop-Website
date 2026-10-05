import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

// Exercise the actual dependency-free client; no provider keys or live writes.
const source = await readFile(new URL('../src/lib/api-client.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { createApiClient, ApiError } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const baseUrl = 'https://shop.example';
const session = { access_token: 'unit-test-token', user: { id: 'customer-a' } };
const cart = { items: [], subtotal_kobo: 120000, shipping_kobo: 150000, total_kobo: 270000 };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function setup(response, currentSession = session) {
  const requests = [];
  const client = createApiClient({ baseUrl, getSession: async () => currentSession, fetcher: async (...args) => {
    requests.push(args); return typeof response === 'function' ? response(...args) : response;
  } });
  return { client, requests };
}

test('public products load without consulting auth or sending cookies', async () => {
  const requests = [];
  const client = createApiClient({ baseUrl: baseUrl + '/', getSession: async () => { throw new Error('must not be called'); },
    fetcher: async (...args) => { requests.push(args); return json({ products: [] }); } });
  assert.deepEqual(await client.products(), []);
  assert.equal(requests[0][0], baseUrl + '/api/products');
  assert.equal(requests[0][1].credentials, 'omit');
  assert.equal(requests[0][1].headers.Authorization, undefined);
});

test('protected GETs use the existing endpoints and a Bearer token', async () => {
  const { client, requests } = setup((url) => url.endsWith('/session') ? json({ user: { id: 'customer-a', name: 'Test', email: 'test@example.com' } }) : json({ cart }));
  assert.equal((await client.customer('customer-a')).id, 'customer-a');
  assert.deepEqual(await client.cart('customer-a'), cart);
  assert.deepEqual(requests.map(([url]) => url), [baseUrl + '/api/session', baseUrl + '/api/cart']);
  for (const [, options] of requests) {
    assert.equal(options.headers.Authorization, 'Bearer unit-test-token');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.headers.Origin, undefined);
  }
});

for (const [operation, quantity] of [['add', 1], ['set', 4], ['set', 0]]) {
  test(`cart ${operation} ${quantity} sends exact existing contract and keeps server totals`, async () => {
    const { client, requests } = setup(json({ cart }));
    const change = { product_id: '10000000-0000-4000-8000-000000000012', quantity, operation };
    assert.deepEqual(await client.changeCart('customer-a', change), cart);
    assert.equal(requests[0][0], baseUrl + '/api/cart');
    assert.equal(requests[0][1].method, 'POST');
    assert.deepEqual(JSON.parse(requests[0][1].body), change);
    assert.equal(requests[0][1].headers.Authorization, 'Bearer unit-test-token');
    assert.equal(requests[0][1].headers.Origin, undefined);
  });
}
for (const invalidSession of [null, { access_token: '', user: { id: 'customer-a' } }, { ...session, user: { id: 'another-customer' } }]) {
  test(`missing, empty or changed session prevents all private network requests: ${JSON.stringify(invalidSession?.user ?? null)}`, async () => {
    const { client, requests } = setup(json({ cart }), invalidSession);
    for (const request of [() => client.customer('customer-a'), () => client.cart('customer-a'), () => client.changeCart('customer-a', { product_id: 'p', quantity: 1, operation: 'add' })]) {
      await assert.rejects(request, (error) => error instanceof ApiError && error.status === 401);
    }
    assert.equal(requests.length, 0);
  });
}

test('gets a fresh token for each private request', async () => {
  let token = 0;
  const sent = [];
  const client = createApiClient({ baseUrl, getSession: async () => ({ ...session, access_token: `token-${++token}` }),
    fetcher: async (_url, options) => { sent.push(options.headers.Authorization); return json({ cart }); } });
  await client.cart('customer-a'); await client.cart('customer-a');
  assert.deepEqual(sent, ['Bearer token-1', 'Bearer token-2']);
});

for (const status of [400, 401, 403, 409, 500]) {
  test(`HTTP ${status} surfaces API error without retrying or falling back to guest`, async () => {
    const { client, requests } = setup(json({ error: 'Request rejected' }, status));
    await assert.rejects(() => client.changeCart('customer-a', { product_id: 'p', quantity: 1, operation: 'add' }),
      (error) => error.status === status && error.message === 'Request rejected');
    assert.equal(requests.length, 1);
  });
}

test('malformed JSON becomes a readable error', async () => {
  const { client } = setup(new Response('<html>unavailable</html>', { status: 502 }));
  await assert.rejects(() => client.products(), /unreadable response/);
});
test('unexpected product response is rejected', async () => {
  const { client } = setup(json({ products: null }));
  await assert.rejects(() => client.products(), /catalogue could not be read/);
});
test('a different API customer is not accepted', async () => {
  const { client } = setup(json({ user: { id: 'customer-b' } }));
  await assert.rejects(() => client.customer('customer-a'), (error) => error.status === 401);
});
test('network failure does not expose raw errors or retry POST', async () => {
  const { client, requests } = setup(() => { throw new Error('internal network detail'); });
  await assert.rejects(() => client.changeCart('customer-a', { product_id: 'p', quantity: 1, operation: 'add' }), /Check your connection/);
  assert.equal(requests.length, 1);
});
test('timeout aborts fetch and gives a retry message', async () => {
  const client = createApiClient({ baseUrl, getSession: async () => null, timeoutMs: 5,
    fetcher: (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) });
  await assert.rejects(() => client.products(), /took too long/);
});
test('session restoration errors never send a private request', async () => {
  let sent = false;
  const client = createApiClient({ baseUrl, getSession: async () => { throw new Error('storage detail'); }, fetcher: async () => { sent = true; return json({ cart }); } });
  await assert.rejects(() => client.cart('customer-a'), /could not be restored/);
  assert.equal(sent, false);
});

for (const id of [undefined, null, '']) {
  test(`missing caller identity cannot become a guest cart request: ${id}`, async () => {
    const { client, requests } = setup(json({ cart }));
    await assert.rejects(() => client.cart(id), (error) => error.status === 401);
    await assert.rejects(() => client.changeCart(id, { product_id: 'p', quantity: 1, operation: 'add' }), (error) => error.status === 401);
    assert.equal(requests.length, 0);
  });
}
