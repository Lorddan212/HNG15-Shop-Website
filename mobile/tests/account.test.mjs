import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';

const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const copyModule = { exports: {} };
new Function('exports', compile(await readFile(new URL('../src/lib/account-content.ts', import.meta.url), 'utf8')))(copyModule.exports);
const source = compile(await readFile(new URL('../src/app/(tabs)/account.tsx', import.meta.url), 'utf8'));
function screen(overrides = {}) {
  const state = { hasSession: false, hasGuestItems: false, accountLoading: false, cart: { items: [] }, ...overrides };
  const module = { exports: {} };
  new Function('require', 'exports', source)(name => {
    if (name === 'react/jsx-runtime') return jsx;
    if (name === 'expo-router') return { router: {} };
    if (name === 'react-native') return { RefreshControl: 'RefreshControl', ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: styles => styles } };
    if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
    if (name === '@/components/ui') return { Button: 'Button', Header: 'Header', ErrorNotice: 'ErrorNotice', Loading: 'Loading' };
    if (name === '@/constants/theme') return { colors: {}, common: {} };
    if (name === '@/providers/shop-provider') return { useShop: () => state };
    if (name === '@/lib/account-content') return copyModule.exports;
    throw new Error('Unexpected import ' + name);
  }, module.exports);
  const nodes = [], text = [];
  const visit = node => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node === 'string') { text.push(node); return; }
    if (node?.props) { nodes.push(node); visit(node.props.children); }
  };
  visit(module.exports.default());
  return { text: text.join(' '), buttons: nodes.filter(n => n.type === 'Button').map(n => n.props) };
}
test('empty guest account introduces Google signup/sign-in without assuming a selection', () => {
  const result = screen();
  assert.match(result.text, /Your FolioVale account/);
  assert.match(result.text, /Sign in or create an account with Google to save your cart, view your orders/);
  assert.doesNotMatch(result.text, /Keep your selection close/);
  assert(result.buttons.some(b => b.title === 'Continue with Google'));
  assert(result.buttons.some(b => b.title === 'Browse the collection'));
  assert(!result.buttons.some(b => b.title === 'My orders'));
});
test('persisted guest items get contextual cart copy', () => {
  const result = screen({ hasGuestItems: true });
  assert.match(result.text, /Keep your selection close/);
  assert.match(result.text, /save this cart and sync it across your phone/);
  assert(!result.buttons.some(b => b.title === 'My orders'));
});
test('My orders appears for the authenticated account only', () => {
  const result = screen({ hasSession: true, user: { id: 'u', name: 'Test', email: 'test@example.com' } });
  assert(result.buttons.some(b => b.title === 'My orders'));
  assert(result.buttons.some(b => b.title === 'Sign out'));
  assert(!result.buttons.some(b => b.title === 'Continue with Google'));
});
test('Google action exposes its busy state while connecting', () => {
  assert.equal(screen({ signingIn: true }).buttons.find(b => b.title === 'Connecting to Google…').busy, true);
});
