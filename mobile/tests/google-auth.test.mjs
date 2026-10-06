import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import ts from 'typescript';
const source = await readFile(new URL('../src/lib/google-auth-flow.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { createGoogleAuthFlow, MOBILE_CALLBACK, PENDING_AUTH_KEY } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const supabaseUrl = 'https://foliovale-test.supabase.co';
const callback = MOBILE_CALLBACK + '?code=test-one-time-code';
const flowId = 'unit-test-flow-123'; const now = 1000000;
function memoryStorage() {
  const data = new Map();
  return { data, getItem: async (key) => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); }, removeItem: async (key) => { data.delete(key); } };
}
function setup(overrides = {}) {
  const storage = overrides.storage ?? memoryStorage();
  const calls = { authorize: 0, open: [], exchange: [] };
  const url = new URL(supabaseUrl + '/auth/v1/authorize');
  url.search = new URLSearchParams({ provider: 'google', redirect_to: MOBILE_CALLBACK, code_challenge_method: 's256', code_challenge: 'a'.repeat(43) });
  const deps = { supabaseUrl, storage, now: () => now,
    authorize: async () => { calls.authorize++; return { url: url.href, flowId }; },
    exchange: async (...args) => { calls.exchange.push(args); },
    openBrowser: async (...args) => { calls.open.push(args); return { type: 'success', url: callback }; }, ...overrides };
  return { flow: createGoogleAuthFlow(deps), calls, storage, url };
}
async function pending(storage, startedAt = now) { await storage.setItem(PENDING_AUTH_KEY, JSON.stringify({ flowId, startedAt })); }

test('success uses exact callback and exchanges only the code with its SDK flow identifier', async () => {
  const { flow, calls, storage } = setup(); await flow.signIn();
  assert.equal(calls.authorize, 1); assert.equal(calls.open[0][1], 'foliovale://auth/callback');
  assert.deepEqual(calls.exchange, [['test-one-time-code', flowId]]);
  assert.equal(await storage.getItem(PENDING_AUTH_KEY), null);
});
test('double tapping sign-in opens one browser', async () => {
  const { flow, calls } = setup(); await Promise.all([flow.signIn(), flow.signIn()]);
  assert.equal(calls.authorize, 1); assert.equal(calls.open.length, 1); assert.equal(calls.exchange.length, 1);
});
test('duplicate browser/Router callbacks exchange a code once', async () => {
  const { flow, calls, storage } = setup(); await pending(storage);
  await Promise.all([flow.complete(callback), flow.complete(callback)]); await flow.complete(callback);
  assert.equal(calls.exchange.length, 1);
});
test('a cold app restart restores the pending attempt', async () => {
  const storage = memoryStorage(); await pending(storage);
  const resumed = setup({ storage }); await resumed.flow.complete(callback);
  assert.equal(resumed.calls.authorize, 0); assert.deepEqual(resumed.calls.exchange, [['test-one-time-code', flowId]]);
});
for (const state of ['cancel', 'dismiss']) test(`browser ${state} clears pending state and allows retry`, async () => {
  const { flow, calls, storage } = setup({ openBrowser: async () => ({ type: state }) });
  await assert.rejects(flow.signIn(), /cancelled/); assert.equal(await storage.getItem(PENDING_AUTH_KEY), null);
  await assert.rejects(flow.signIn(), /cancelled/); assert.equal(calls.authorize, 2);
});
test('Android dismissal after Router success does not report cancellation', async () => {
  const instance = setup({ openBrowser: async () => { await instance.flow.complete(callback); return { type: 'dismiss' }; } });
  await instance.flow.signIn(); assert.equal(instance.calls.exchange.length, 1);
});
for (const bad of ['https://shop.example/auth/callback?code=x', 'foliovale://evil/callback?code=x', 'foliovale://auth/callback/extra?code=x', 'foliovale://user@auth/callback?code=x', 'foliovale://auth:90/callback?code=x', 'foliovale://auth/callback#access_token=untrusted', 'not-a-url']) {
  test(`rejects wrong callback target or token fragment: ${bad}`, async () => {
    const { flow, calls, storage } = setup(); await pending(storage);
    await assert.rejects(flow.complete(bad), /callback|invalid/); assert.equal(calls.exchange.length, 0);
  });
}
for (const query of ['', '?code=', '?code=a&code=b', '?code=a&access_token=untrusted', '?code=%20', '?error=access_denied&error_description=private-detail']) {
  test(`malformed or denied callback cannot exchange: ${query}`, async () => {
    const { flow, calls, storage } = setup(); await pending(storage);
    await assert.rejects(flow.complete(MOBILE_CALLBACK + query), (error) => !error.message.includes('private-detail'));
    assert.equal(calls.exchange.length, 0);
  });
}
test('unsolicited callback cannot create a session', async () => {
  const { flow, calls } = setup(); await assert.rejects(flow.complete(callback), /missing or expired/); assert.equal(calls.exchange.length, 0);
});
test('expired attempt fails before exchange', async () => {
  const { flow, storage, calls } = setup(); await pending(storage, now - 16 * 60 * 1000);
  await assert.rejects(flow.complete(callback), /expired/); assert.equal(calls.exchange.length, 0);
});
test('SDK errors are sanitized and clear the pending attempt', async () => {
  const { flow, storage } = setup({ exchange: async () => { throw new Error('raw-token-and-code'); } }); await pending(storage);
  await assert.rejects(flow.complete(callback), (error) => /could not be verified/.test(error.message) && !error.message.includes('raw-token'));
  assert.equal(await storage.getItem(PENDING_AUTH_KEY), null);
});
for (const field of ['host', 'challenge', 'redirect']) test(`unsafe authorization ${field} is never opened`, async () => {
  const initial = setup();
  if (field === 'host') initial.url.hostname = 'wrong.example';
  if (field === 'challenge') initial.url.searchParams.set('code_challenge_method', 'plain');
  if (field === 'redirect') initial.url.searchParams.set('redirect_to', 'https://wrong.example');
  const next = setup({ authorize: async () => ({ url: initial.url.href, flowId }) });
  await assert.rejects(next.flow.signIn(), /Secure Google/); assert.equal(next.calls.open.length, 0);
});
test('URL identity fields are never used as customer identity', async () => {
  const { flow, storage, calls } = setup(); await pending(storage);
  await flow.complete(callback + '&user_id=attacker&email=attacker@example.com');
  assert.deepEqual(calls.exchange, [['test-one-time-code', flowId]]);
});

test('installed Supabase SDK verifies S256 exchange, persists session, emits auth events and clears only the local session on signOut()', async () => {
  const storage = memoryStorage(); const requests = []; const events = [];
  const uid = '11111111-1111-4111-8111-111111111111';
  const jwt = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub: uid, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'test-signature'].join('.');
  const client = createClient(supabaseUrl, 'public-unit-test-key', {
    auth: { storage, storageKey: 'phase3-sdk-test', flowType: 'pkce', persistSession: true, detectSessionInUrl: false, autoRefreshToken: false },
    global: { fetch: async (url, options) => {
      requests.push([String(url), options]);
      if (String(url).includes('/token?grant_type=pkce')) return new Response(JSON.stringify({ access_token: jwt, refresh_token: 'test-refresh-token', expires_in: 3600, token_type: 'bearer', user: { id: uid, aud: 'authenticated', email: 'test@example.com', app_metadata: { provider: 'google' }, user_metadata: {}, created_at: new Date().toISOString() } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (String(url).includes('/logout')) return new Response(null, { status: 204 });
      throw new Error('Unexpected test network request');
    } },
  });
  const { data: { subscription } } = client.auth.onAuthStateChange((event) => { events.push(event); });
  try {
    const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: MOBILE_CALLBACK, skipBrowserRedirect: true, scopes: 'email profile' } });
    assert.equal(error, null); const url = new URL(data.url);
    assert.equal(url.searchParams.get('code_challenge_method'), 's256');
    const exchanged = await client.auth.exchangeCodeForSession('sdk-test-code', { flowId: data.flowId });
    assert.equal(exchanged.error, null); assert.equal(exchanged.data.user.id, uid);
    const body = JSON.parse(requests[0][1].body);
    assert.equal(body.auth_code, 'sdk-test-code');
    assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'), url.searchParams.get('code_challenge'));
    assert.equal(JSON.parse(await storage.getItem('phase3-sdk-test')).user.id, uid);
    assert.equal((await client.auth.getSession()).data.session.user.id, uid);
    assert.ok(events.includes('SIGNED_IN'));
    const signedOut = await client.auth.signOut({ scope: 'local' }); assert.equal(signedOut.error, null);
    assert.equal((await client.auth.getSession()).data.session, null);
    assert.equal(await storage.getItem('phase3-sdk-test'), null);
    assert.ok(events.includes('SIGNED_OUT'));
    assert.deepEqual(requests.filter(([url]) => new URL(url).pathname.endsWith('/logout')).map(([url]) => new URL(url).searchParams.get('scope')), ['local']);
  } finally { subscription.unsubscribe(); client.auth.stopAutoRefresh(); }
});
