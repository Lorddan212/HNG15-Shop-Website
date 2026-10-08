# Web/mobile parity checkpoint

Implemented on `mobile-order-history` on 8 October 2026. No commit, push, deployment, APK build, EAS/Supabase configuration change or migration was performed.

## Existing contracts

| Mobile method | Existing endpoint | Success response |
| --- | --- | --- |
| `orders(userId)` | GET /api/orders | `{ orders: Order[] }` |
| `order(userId, orderId)` | GET /api/orders/:id | `{ order: Order }` |
| `deleteOrder(userId, orderId)` | DELETE /api/orders/:id | `{ deleted: true }` |

All three use the existing client and the latest Supabase Bearer token, omit cookies, check the caller/session UUID, retain timeout/error handling and validate responses. Order responses must match the expected owner; details must also match the requested order ID. The backend's existing ownership checks and soft-deletion filter remain authoritative and unchanged. No local order persistence or second backend was added.

## Account and orders

Empty-cart guests see **Your FolioVale account**. Guests with persisted items see **Keep your selection close**. Both use the unchanged Google OAuth action for existing and first-time users. Persisted guest selection drives the wording even when the catalogue is unavailable.

Signed-in Account exposes **My orders**. Exactly three tabs remain: Shop, Cart and Account. Orders list/detail routes are outside the tabs. They refetch on focus/navigation and support pull-to-refresh, loading, empty, error/retry and signed-out states. Responses from a previous account or blurred screen are ignored.

Details display saved products, quantities, unit prices, subtotal, delivery fee, total, delivery/contact details, optional notes, payment method, order status and email status. No online payment or dispatch is claimed.

**Delete from history** requires confirmation on the details screen. It invokes the existing DELETE endpoint, then returns to My orders, which refetches. A 404 explains that the order is no longer available; 401 directs the customer to Account; network/server errors allow refresh/retry. Removal affects the shared visible history without cancelling, restoring stock or erasing transaction records. The other client sees it after orders refresh/navigation; orders have no Realtime subscription.

## Website cart synchronization

The existing browser Supabase client subscribes only for authenticated accounts, using `UPDATE` on `public.carts` filtered by the user's UUID. The payload is ignored. Notifications debounce for 250 ms and trigger GET /api/cart.

One cart-read coordinator handles background signals and ordinary refresh. It prevents overlapping reads, queues one follow-up when signalled during a request, and invalidates old snapshots when identity or a local mutation changes. Local POST responses update the cart immediately. Browser focus/visibility and subscription readiness reconcile missed changes.

Sign-out, account changes and unmount stop the old subscription. The website auth listener defers API work out of Supabase's auth callback. Public/guest shopping remains available without a Realtime channel. Existing mobile Realtime logic is unchanged.

The signed-in website header now reads **My orders → Cart → Sign out**. Signed-out actions remain **Sign in → Cart**. Order navigation/copy consistently uses My orders.

## Automated verification

| Check | Result |
| --- | --- |
| Root npm run typecheck | Passed |
| Root npm test | 49/49 passed |
| Root npm run build | Passed |
| Mobile npx tsc --noEmit | Passed |
| Mobile npm run lint | Passed without warnings |
| Mobile npm test | 104/104 passed |
| Mobile npx expo-doctor | 21/21 passed |

Ten website tests cover owner filters, guest exclusion, notification debounce, serial/follow-up reads, mutation/identity races, cleanup and foreground recovery. Twenty added mobile tests cover order contracts, Bearer/session handling, ownership/payload validation, deletion acknowledgement, failures/timeouts, and actual Account component branches with native UI dependencies stubbed. Existing tests remain intact.

Expo's ignored route declarations were regenerated using an isolated offline Metro session, which was then stopped. This was not an EAS or APK build. No provider calls were made to create/delete real orders during automated tests.

## Remaining device/browser checks

These changes are implemented and locally tested, not deployed or included in an existing APK automatically. Verify the updated website and updated mobile app together before recording the final submission:

1. First-time and returning Google users; empty and populated guest carts.
2. Exactly three tabs, Account → My orders, list/detail layouts and navigation.
3. Website-created and mobile-created orders appear in the same account history.
4. Confirmation cancellation, successful removal, 404, expired session and network failure; opposite-client history updates on refresh/navigation.
5. Cart add/quantity/removal in both directions without manual refresh; rapid local edits during incoming signals.
6. Browser/tab and mobile background recovery; account switching and sign-out stop old subscriptions.
7. Final preview APK installation and the required continuous demonstration video.

No final physical-device or live two-client result is claimed for this parity patch. Existing development-build results predate these changes. The current Lesson 3 submission requirements remain in [HNG15_LESSON3_COMPLIANCE.md](HNG15_LESSON3_COMPLIANCE.md).

Implementation references: [Expo Router focus lifecycle](https://docs.expo.dev/versions/v57.0.0/sdk/router/#usefocuseffecteffect-do_not_pass_a_second_prop), [Supabase Postgres change subscriptions](https://supabase.com/docs/guides/realtime/postgres-changes), [Supabase Google authentication](https://supabase.com/docs/guides/auth/social-login/auth-google).
