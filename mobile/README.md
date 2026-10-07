# FolioVale Mobile

Expo SDK 57, React Native, TypeScript, and Expo Router. The storefront uses the existing FolioVale API. Google sign-in uses the same Supabase project as the website. Guests have a persistent local cart, signed-in customers have pay-on-delivery checkout, and authenticated account carts reconcile from website changes through Supabase Realtime.

## Run locally

From this directory, run `npm install --include=dev` if dependencies are missing. Copy `.env.example` to `.env` only if you do not already have `.env`, then fill in the Supabase project URL and publishable key. The three public variables are bundled into the app; use only the public project configuration here. Restart Expo after changing them.

Use an Android development build for Google sign-in, then run `npx expo start --dev-client`. Ordinary Expo Go and the web preview can browse but cannot perform this custom-scheme auth flow. Follow [Phase 3 authentication setup](PHASE3_AUTH.md) for the callback configuration and build instructions. The API must be reachable from that device. The default API URL is the production FolioVale website.

The native app is the target. A browser preview may be blocked by the production API's cross-origin policy; a successful web bundle does not prove native behavior or authenticated flows.

## Navigation and behavior

- `src/app/(tabs)/index.tsx`: Shop, public catalogue, prices, stock, refresh and error states.
- `src/app/(tabs)/cart.tsx`: Guest and account carts, quantity changes, removal, totals, and checkout navigation.
- `src/app/(tabs)/account.tsx`: Account introduction, real customer details when a session exists, and sign-out.
- `src/app/checkout.tsx`: Delivery form and saved-order confirmation.
- `src/lib/guest-cart.ts`: Persistent guest items and resumable merge journal.
- `src/lib/checkout-flow.ts`: Delivery validation and retained checkout attempts.
- `src/providers/shop-provider.tsx`: Session restoration, shared state, auth listener, foreground reconciliation and account-cart Realtime lifecycle.
- `src/lib/cart-realtime.ts`: Authenticated `public.carts` UPDATE subscription, debounce, in-flight guard and cleanup.
- `src/lib/api-client.ts`: Existing `/api/products`, `/api/session`, `/api/cart` and `/api/checkout` contracts. Private requests require the latest session token and omit cookies. Guest cart operations stay on the device. No automatic network mutation retries.
- `src/lib/supabase.ts`: One client; AsyncStorage persists native sessions and foreground activity controls token refresh.

Continue with Google starts Supabase S256 PKCE and opens the system browser. The exact callback is `foliovale://auth/callback`. The SDK exchanges the one-time code with its stored verifier, persists the real session, and triggers customer/cart refresh. There is no test login.

The website and mobile app share account carts through the existing backend. Signed-in mobile sessions subscribe to `public.carts` UPDATE events filtered by their Supabase UUID. Realtime is only a notification layer: every event is debounced and reconciled through authenticated `GET /api/cart`, which remains the source of truth. Pull to refresh and foreground reconciliation still recover missed events. Guest carts remain local and create no Realtime channel. Sign-out removes the account channel and calls `supabase.auth.signOut({ scope: 'local' })`. Mobile user/cart state and the persisted mobile session are cleared while public browsing remains available. The website and other devices remain signed in independently; mobile sign-out does not intentionally revoke their sessions.

Launcher, adaptive, monochrome, splash and favicon branding use the canonical open-book mark from `../public/favicon.svg`. The preview APK profile is configured without the development client; see [preview preparation and content audit](../CONTENT_AUDIT.md). No preview APK has been built as part of this preparation.

## Verification

Run `npx expo-doctor`, `npx tsc --noEmit`, `npm run lint`, and `npm test` here. API-client tests run locally with controlled responses and do not alter production data. Also run the root website's typecheck, tests and build. Device and live authentication checks are separate from these commands.

## Guest shopping and checkout parity

Signed-out customers can add, adjust and remove items without signing in. The Cart screen says **Sign in to save and sync this cart across devices.** AsyncStorage key `foliovale.guest-cart.v1` stores product IDs, quantities and an account-bound merge journal. Prices are never persisted: current `/api/products` data supplies prices and stock. Quantities are capped at stock and 10. Delivery is zero on an empty cart, ₦1,500 below ₦30,000, and free at or above ₦30,000. Refresh reprices and clamps the displayed selection. A fresh offline launch needs the catalogue before showing prices; catalogue errors never delete saved guest items.

After Google login, the provider refreshes `/api/session` and the account cart. Guest quantities are added to existing quantities, subject to stock/10 caps. Each final absolute target is persisted before authenticated `POST /api/cart` with `operation: "set"`. A serial queue and checkpoints prevent repeated auth events, partial failures, lost responses or restarts from adding the same quantities twice. Completed entries are skipped, larger account quantities observed on retry are preserved, and guest storage clears only after the final account-cart refetch. An interrupted journal must finish under its original account; another account cannot consume it.

**Concurrency boundary:** the existing API has no conditional-write version or atomic mobile merge endpoint. Another device writing the same item between the final GET and POST remains a last-write-wins race. This journal provides retry safety, not a cross-device transaction. Avoid simultaneous edits during a merge. Website guest cookies and backend contracts are unchanged.

### Checkout contract and recovery

The cart offers **Sign in to checkout** to guests and **Proceed to checkout** to signed-in users. `/checkout` is outside the three tabs and guards guest/empty-cart access. Delivery validation matches website trimming, length limits and phone characters. State is a text input with the backend's 2–80 character constraint. Only **Pay on delivery** is available, with **No card details or online payment needed.** The pre-launch testing disclosure remains visible.

`POST /api/checkout` sends `Authorization: Bearer <access_token>`, no cookies, and exactly these JSON fields:

```ts
{ request_id, full_name, phone, address, city, state, notes }
```

No client price, user ID or payment data is sent. The server checks stock, calculates totals and returns the saved order.

The Expo Crypto UUID is stored before submission under `foliovale.checkout-attempt.v1.<user-id>`. Network retries and navigation retain that UUID and the original in-memory delivery details. A definitive validation/stock rejection allows corrected details with the same UUID. After an app restart, the UUID is restored and delivery details must be re-entered; if already recorded, the backend returns the original order. This feature does not persist addresses or phone numbers. A lost response never causes UUID rotation.

Success shows the saved reference, server total, Pay on delivery and no online payment taken. It refetches the authenticated cart and states **Your cart is cleared** only when that response is empty. Refetch failure preserves the saved order and offers confirmation retry without another checkout POST. New cart items from another device are not deleted. Email acceptance is not inbox delivery; existing Mailgun sandbox recipient restrictions still apply.

Local-only Supabase sign-out, Google OAuth and the shared Supabase project are preserved. No new dependencies, native settings, website behavior, database migrations or payment providers were added.

## Realtime account-cart synchronization

The authenticated channel is named `account-cart:<user-id>` and listens only for `UPDATE` on `public.carts` with filter `user_id=eq.<user-id>`. The Phase 1 migration already publishes safe cart metadata and grants authenticated owners SELECT access to only their own cart, so no new database migration is required. The client never reads `token_hash` and never writes cart tables directly.

A 250 ms debounce coalesces duplicate parent-cart notifications. Only one reconciliation fetch runs at a time; another signal received during that fetch schedules one follow-up. `SUBSCRIBED` triggers an immediate API reconciliation, and returning the native app to the foreground also reconciles once. `CHANNEL_ERROR`, `TIMED_OUT` and `CLOSED` are tracked internally without replacing a usable cart with a technical WebSocket error. User changes, sign-out and unmount clear timers and call `supabase.removeChannel` for the old channel.

### Physical-device checks still required

Use the existing Android development build with `npx expo start --dev-client`; this JavaScript-only phase does not request an EAS rebuild.

1. Guest add/quantity/remove, delivery thresholds and app-restart persistence.
2. Google login with an existing website cart, capped combined quantities, repeated auth events and interrupted merge recovery.
3. Delivery form, keyboard layout, validation, back navigation, empty cart and expired session.
4. With the same Google account signed in on website and mobile, change the website cart while the mobile Cart screen is visible and confirm it updates without pull-to-refresh.
5. Background the mobile app, change the website cart, reopen mobile and confirm foreground reconciliation catches up.
6. Test order submission, saved reference/total and cleared account cart on both clients.
7. Lost checkout response and app restart: retry and confirm only one order exists.
8. Stock-change handling, account switching and local sign-out while the website stays signed in; the old account channel must stop receiving updates.

Tests use controlled responses and do not create production orders. Device behavior and email delivery require separate verification.

### Verification recorded for this phase

On 6 October 2026: mobile TypeScript and lint passed; all 77 mobile tests passed; Expo Doctor passed 21/21 checks. Root TypeScript, all 39 tests and the production build passed. The route declarations were regenerated locally for `/checkout`. No EAS build, deployment, commit or push was performed. Physical-device and live-order verification remain pending.
