import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';
async function load(file) {
  const source = await readFile(new URL(`../src/lib/${file}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { changeGuest, guestCart, createGuestStore, GUEST_CART_KEY } = await load('guest-cart');
const { createCheckoutFlow, validateDelivery, checkoutKey } = await load('checkout-flow');
const { createApiClient } = await load('api-client');
const product = { id: '10000000-0000-4000-8000-000000000001', name: 'Notebook', price_kobo: 500000, stock: 20 };
const second = { ...product, id: '10000000-0000-4000-8000-000000000002', stock: 3 };
const catalogue = [product, second];
const entry = (quantity, product_id = product.id) => ({ product_id, quantity });
const change = (quantity, operation = 'set', product_id = product.id) => ({ product_id, quantity, operation });
function storage() {
  const values = new Map();
  return { values, getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); }, removeItem: async key => { values.delete(key); } };
}
function account(initial = [entry(2)]) {
  let items = initial;
  const writes = [];
  return { writes, api: { products: async () => catalogue, cart: async () => guestCart(items, catalogue),
    changeCart: async (id, input) => { writes.push({ id, ...input }); items = changeGuest(items, input, catalogue); return guestCart(items, catalogue); } } };
}
const active = () => true;

test('guest add/set/remove caps stock and ten, without authentication', () => {
  let items = changeGuest([], change(2, 'add'), catalogue);
  items = changeGuest(items, change(2, 'add'), catalogue);
  assert.equal(items[0].quantity, 4);
  assert.equal(changeGuest(items, change(10, 'add'), catalogue)[0].quantity, 10);
  assert.equal(changeGuest([], change(9, 'set', second.id), catalogue)[0].quantity, 3);
  assert.equal(changeGuest(items, change(1), catalogue)[0].quantity, 1);
  assert.deepEqual(changeGuest(items, change(0), catalogue), []);
  assert.throws(() => changeGuest(items, change(-1), catalogue));
  assert.throws(() => changeGuest(items, change(1.5), catalogue));
  assert.throws(() => changeGuest([], change(1), [{ ...product, stock: 0 }]));
});

test('guest totals use latest catalogue, shipping threshold and empty zero', () => {
  assert.equal(guestCart([entry(5)], catalogue).total_kobo, 2650000);
  assert.equal(guestCart([entry(6)], catalogue).shipping_kobo, 0);
  assert.equal(guestCart([], catalogue).shipping_kobo, 0);
  assert.equal(guestCart([entry(2)], [{ ...product, price_kobo: 600000, stock: 1 }]).subtotal_kobo, 600000);
  assert.deepEqual(guestCart([entry(2)], []).items, []);
});

test('guest persistence survives a new store and stores no product prices', async () => {
  const disk = storage();
  await createGuestStore(disk).change(change(2), catalogue);
  assert.deepEqual(await createGuestStore(disk).items(), [entry(2)]);
  assert.equal(disk.values.get(GUEST_CART_KEY).includes('price'), false);
});

test('failed storage write never acknowledges or loses existing guest contents', async () => {
  const disk = storage(); const store = createGuestStore(disk);
  await store.change(change(2), catalogue);
  disk.setItem = async () => { throw new Error('disk full'); };
  await assert.rejects(store.change(change(3), catalogue));
  assert.deepEqual(await store.items(), [entry(2)]);
});

test('corrupted guest storage is not silently overwritten', async () => {
  const disk = storage(); disk.values.set(GUEST_CART_KEY, 'invalid');
  await assert.rejects(createGuestStore(disk).change(change(1), catalogue), /saved guest cart/);
  assert.equal(disk.values.get(GUEST_CART_KEY), 'invalid');
});

test('login merge preserves account items, adds guest quantities, caps stock and clears guest', async () => {
  const disk = storage(); const store = createGuestStore(disk); const server = account([entry(2), entry(2, second.id)]);
  await store.change(change(3), catalogue);
  await store.change(change(3, 'set', second.id), catalogue);
  const cart = await store.merge('user-a', server.api, active);
  assert.deepEqual(cart.items.map(item => item.quantity), [5, 3]);
  assert.deepEqual(server.writes.map(item => item.operation), ['set', 'set']);
  assert.deepEqual(await store.items(), []);
});

test('simultaneous and repeated auth events merge only once', async () => {
  const store = createGuestStore(storage()); const server = account();
  await store.change(change(2), catalogue);
  await Promise.all([store.merge('user-a', server.api, active), store.merge('user-a', server.api, active)]);
  await store.merge('user-a', server.api, active);
  assert.equal(server.writes.length, 1);
  assert.equal((await server.api.cart()).items[0].quantity, 4);
});

test('lost POST response and process restart reuse durable targets without adding twice', async () => {
  const disk = storage(); const store = createGuestStore(disk); const server = account();
  await store.change(change(3), catalogue);
  const apply = server.api.changeCart;
  server.api.changeCart = async (...args) => { await apply(...args); throw new Error('response lost'); };
  await assert.rejects(store.merge('user-a', server.api, active));
  server.api.changeCart = apply;
  const resumed = createGuestStore(disk);
  assert.equal((await resumed.merge('user-a', server.api, active)).items[0].quantity, 5);
  assert.equal(server.writes.length, 1);
  assert.deepEqual(await resumed.items(), []);
});

test('partial merge resumes unfinished items only', async () => {
  const disk = storage(); const store = createGuestStore(disk); const server = account();
  await store.change(change(1), catalogue); await store.change(change(1, 'set', second.id), catalogue);
  const apply = server.api.changeCart;
  server.api.changeCart = async (...args) => { if (args[1].product_id === second.id) throw new Error('offline'); return apply(...args); };
  await assert.rejects(store.merge('user-a', server.api, active));
  server.api.changeCart = apply;
  await createGuestStore(disk).merge('user-a', server.api, active);
  assert.equal(server.writes.filter(item => item.product_id === product.id).length, 1);
  assert.equal((await server.api.cart()).items.find(item => item.product_id === product.id).quantity, 3);
});

test('merge never lowers a larger quantity seen on retry and binds journal to its account', async () => {
  const disk = storage(); const store = createGuestStore(disk); const server = account();
  await store.change(change(2), catalogue);
  const apply = server.api.changeCart;
  server.api.changeCart = async () => { throw new Error('offline'); };
  await assert.rejects(store.merge('user-a', server.api, active));
  await assert.rejects(store.merge('user-b', server.api, active), /previous account/);
  await apply('user-a', change(7)); server.api.changeCart = apply;
  assert.equal((await store.merge('user-a', server.api, active)).items[0].quantity, 7);
});

test('account change prevents merge writes and retains guest data', async () => {
  const store = createGuestStore(storage()); const server = account();
  await store.change(change(2), catalogue);
  await assert.rejects(store.merge('user-a', server.api, () => false));
  assert.equal(server.writes.length, 0); assert.deepEqual(await store.items(), [entry(2)]);
});

const delivery = { full_name: 'Test Customer', phone: '08012345678', address: '12 Test Street', city: 'Lagos', state: 'Lagos', notes: '' };
const requestId = '10000000-0000-4000-8000-000000000099';
const order = { ...delivery, id: 'order-id', reference: 'FV-TEST', user_id: 'user-a', total_kobo: 650000, payment_method: 'pay_on_delivery', email_status: 'queued' };
function checkoutSetup(disk = storage()) {
  const requests = []; let refetches = 0; let generated = 0;
  const api = { checkout: async (id, input) => { requests.push({ id, input }); return order; }, cart: async () => { refetches++; return guestCart([], catalogue); } };
  const flow = createCheckoutFlow(disk, () => { generated++; return requestId; }, api);
  return { disk, requests, api, flow, refetches: () => refetches, generated: () => generated };
}

test('delivery validation mirrors trimming, lengths and phone character constraints', () => {
  assert.deepEqual(validateDelivery(delivery).errors, {});
  assert.equal(validateDelivery({ ...delivery, full_name: '  Test  ' }).delivery.full_name, 'Test');
  for (const [key, value] of [['full_name', 'x'], ['phone', 'badphone'], ['address', '1234'], ['city', 'x'], ['state', 'x'], ['notes', 'x'.repeat(501)]]) {
    assert.ok(validateDelivery({ ...delivery, [key]: value }).errors[key]);
  }
});

test('checkout uses existing POST contract, bearer token, no cookies/prices/payment fields', async () => {
  let request;
  const client = createApiClient({ baseUrl: 'https://shop.example', getSession: async () => ({ access_token: 'test-token', user: { id: 'user-a' } }),
    fetcher: async (url, options) => { request = { url, ...options }; return Response.json({ order }); } });
  const input = { ...delivery, request_id: requestId };
  assert.deepEqual(await client.checkout('user-a', input), order);
  assert.equal(request.url, 'https://shop.example/api/checkout');
  assert.equal(request.method, 'POST'); assert.equal(request.headers.Authorization, 'Bearer test-token');
  assert.equal(request.credentials, 'omit'); assert.deepEqual(JSON.parse(request.body), input);
});

test('checkout refuses unauthenticated requests before network and preserves validation errors', async () => {
  const client = createApiClient({ baseUrl: 'https://shop.example', getSession: async () => null, fetcher: async () => { assert.fail('no network'); } });
  await assert.rejects(client.checkout('', { ...delivery, request_id: requestId }), /sign in/);
  const invalid = createApiClient({ baseUrl: 'https://shop.example', getSession: async () => ({ access_token: 'token', user: { id: 'user-a' } }), fetcher: async () => Response.json({ error: 'Check fields', fields: { phone: ['Invalid'] } }, { status: 400 }) });
  await assert.rejects(invalid.checkout('user-a', { ...delivery, request_id: requestId }), error => error.status === 400 && error.fields.phone[0] === 'Invalid');
});

test('success refetches and confirms empty cart, clears attempt, and repeated taps return one saved order', async () => {
  const x = checkoutSetup();
  const [a, b] = await Promise.all([x.flow.place('user-a', delivery, active), x.flow.place('user-a', delivery, active)]);
  assert.equal(a.order.reference, 'FV-TEST'); assert.equal(b.order.id, a.order.id); assert.equal(a.cart.items.length, 0);
  assert.equal(x.requests.length, 1); assert.equal(x.refetches(), 1); assert.equal(await x.flow.pending('user-a'), false);
  await x.flow.place('user-a', delivery, active); assert.equal(x.requests.length, 1);
});

test('network retry retains request UUID and original delivery details', async () => {
  const x = checkoutSetup(); const post = x.api.checkout;
  x.api.checkout = async (id, input) => { await post(id, input); throw new Error('lost response'); };
  await assert.rejects(x.flow.place('user-a', delivery, active));
  x.api.checkout = post;
  await x.flow.place('user-a', { ...delivery, city: 'Changed' }, active);
  assert.equal(x.generated(), 1); assert.equal(x.requests[0].input.request_id, x.requests[1].input.request_id);
  assert.equal(x.requests[1].input.city, 'Lagos');
});

test('process restart retains pending request UUID without storing delivery PII', async () => {
  const x = checkoutSetup(); x.api.checkout = async () => { throw new Error('offline'); };
  await assert.rejects(x.flow.place('user-a', delivery, active));
  assert.equal(x.disk.values.get(checkoutKey('user-a')), requestId);
  const resumed = createCheckoutFlow(x.disk, () => assert.fail('must reuse UUID'), { checkout: async (_, input) => { assert.equal(input.request_id, requestId); return order; }, cart: async () => guestCart([], catalogue) });
  assert.equal((await resumed.place('user-a', delivery, active)).order.id, order.id);
});

test('saved order survives cart refresh failure; confirmation retry only refetches', async () => {
  const x = checkoutSetup(); x.api.cart = async () => { throw new Error('offline'); };
  const result = await x.flow.place('user-a', delivery, active);
  assert.equal(result.order.id, order.id); assert.equal(result.cart, null); assert.match(result.warning, /saved/);
  x.api.cart = async () => guestCart([], catalogue);
  assert.equal((await x.flow.place('user-a', delivery, active)).cart.items.length, 0);
  assert.equal(x.requests.length, 1);
});

test('success never claims cart cleared when server contains newer items', async () => {
  const x = checkoutSetup(); x.api.cart = async () => guestCart([entry(1)], catalogue);
  const result = await x.flow.place('user-a', delivery, active);
  assert.equal(result.cart.items.length, 1); assert.match(result.warning, /contains items/);
});

test('validation/stock rejections allow corrections using the same UUID', async () => {
  const x = checkoutSetup(); x.api.checkout = async () => { throw Object.assign(new Error('stock changed'), { status: 409 }); };
  await assert.rejects(x.flow.place('user-a', delivery, active));
  x.api.checkout = async (_, input) => { assert.equal(input.request_id, requestId); assert.equal(input.city, 'Abuja'); return order; };
  await x.flow.place('user-a', { ...delivery, city: 'Abuja' }, active);
});

test('storage failure before checkout causes no POST; failed cleanup cannot create a new attempt', async () => {
  const x = checkoutSetup(); const save = x.disk.setItem;
  x.disk.setItem = async () => { throw new Error('disk full'); };
  await assert.rejects(x.flow.place('user-a', delivery, active)); assert.equal(x.requests.length, 0);
  x.disk.setItem = save; x.disk.removeItem = async () => { throw new Error('disk failure'); };
  const result = await x.flow.place('user-a', delivery, active); assert.match(result.warning, /saved/);
  await assert.rejects(x.flow.finish('user-a'));
  await x.flow.place('user-a', delivery, active); assert.equal(x.requests.length, 1);
});


test('merge incorporates a newer account quantity seen before the first POST', async () => {
  const store = createGuestStore(storage()); const server = account();
  await store.change(change(2), catalogue);
  const read = server.api.cart; let reads = 0;
  server.api.cart = async () => { if (++reads === 2) await server.api.changeCart('user-a', change(3)); return read(); };
  assert.equal((await store.merge('user-a', server.api, active)).items[0].quantity, 5);
});

test('guest merge rechecks stock on retry and never sends an excessive quantity', async () => {
  const store = createGuestStore(storage()); const server = account([]);
  await store.change(change(10), catalogue);
  const post = server.api.changeCart;
  server.api.changeCart = async () => { throw new Error('offline'); };
  await assert.rejects(store.merge('user-a', server.api, active));
  server.api.changeCart = post;
  server.api.products = async () => [{ ...product, stock: 2 }];
  await store.merge('user-a', server.api, active);
  assert.equal(server.writes[0].quantity, 2);
});

test('checkout draft remains available for a retry after screen navigation', async () => {
  const x = checkoutSetup(); x.api.checkout = async () => { throw new Error('offline'); };
  await assert.rejects(x.flow.place('user-a', delivery, active));
  assert.equal(x.flow.draft('user-a').address, delivery.address);
  assert.equal(x.flow.draft('user-b'), undefined);
});


test('sign-out forgets private in-memory details while retaining unresolved UUID recovery', async () => {
  const x = checkoutSetup(); x.api.checkout = async () => { throw new Error('offline'); };
  await assert.rejects(x.flow.place('user-a', delivery, active));
  x.flow.forget('user-a');
  assert.equal(x.flow.draft('user-a'), undefined);
  assert.equal(await x.flow.pending('user-a'), true);
});

test('a completed checkout can be finished before placing a new order', async () => {
  const x = checkoutSetup();
  await x.flow.place('user-a', delivery, active);
  await x.flow.finish('user-a');
  await x.flow.place('user-a', delivery, active);
  assert.equal(x.generated(), 2); assert.equal(x.requests.length, 2);
});
