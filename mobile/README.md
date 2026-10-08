# FolioVale Mobile

The Expo SDK 57 / React Native app uses Expo Router and the existing FolioVale production API and Supabase project. The [root README](../README.md) is the primary architecture, environment and release-status guide.

## Local development

Preserve an existing `.env`. Otherwise copy `.env.example` and fill the three public variables: `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never add private web credentials. The API must be reachable from the phone; localhost on a phone is the phone itself.

```sh
npm ci --include=dev
npx expo start --dev-client
```

Use the installed Android development build. Ordinary Expo Go and browser preview are not supported targets for native Google authentication. Browser preview may also encounter the website API's cross-origin protections.

## Routes

| Route | Purpose |
| --- | --- |
| `src/app/(tabs)/index.tsx` | Shop, catalogue and refresh |
| `src/app/(tabs)/cart.tsx` | Guest/account cart, quantities, totals and checkout navigation |
| `src/app/(tabs)/account.tsx` | Google sign-in, real account details and sign-out |
| `src/app/checkout.tsx` | Delivery form and saved-order confirmation |
| `src/app/auth/callback.tsx` | Validated native authentication completion |
| `src/app/orders/index.tsx` | My orders, refresh and empty/error states |
| `src/app/orders/[id].tsx` | Saved order details and confirmed removal from history |

## Account and My orders

Signed-out Account copy distinguishes an empty guest cart from a persisted selection. Continue with Google remains the only sign-in/account-creation action. Authenticated Account shows My orders; Shop, Cart and Account remain the only tabs.

Orders use the existing GET /api/orders, GET /api/orders/:id and DELETE /api/orders/:id endpoints with the current Bearer token. The client validates the owner, detail ID, snapshot fields and deletion acknowledgement. Order data stays in memory; no local order store or order Realtime channel exists.

List/detail screens refetch on navigation and pull-to-refresh. They ignore stale responses after account changes or screen blur. Details show saved items/prices, totals, delivery/contact details, optional notes, order/payment/email status and Pay on Delivery wording. Delete from history requires confirmation and returns to the refetched list. It does not cancel, restore stock or erase the transaction. The website sees the same removal on its next orders refresh/navigation. Expired sessions, missing orders and network/server failures have explicit recovery states.

## Authentication

Account starts Supabase Google OAuth with S256 PKCE and `skipBrowserRedirect: true`. Expo WebBrowser opens the authorization URL. The callback is exactly `foliovale://auth/callback`. It must remain allowed in Supabase URL Configuration alongside existing website callbacks.

Google's existing Web OAuth client returns to Supabase at `https://qolxxboicrhhrunfljbj.supabase.co/auth/v1/callback`. Do not replace that URL with the mobile scheme. The app does not embed a Google client secret or maintain a second identity system.

The auth coordinator validates the target and pending attempt, rejects unsolicited/expired/malformed callbacks, and deduplicates deliveries. `exchangeCodeForSession(code, { flowId })` uses the installed SDK's stored verifier and persists the real session in AsyncStorage. URL user fields are ignored. The provider refreshes the server session and account cart. Private API calls retrieve the current access token.

Sign-out uses `supabase.auth.signOut({ scope: 'local' })`, clears mobile account state and removes the account's Realtime channel. Browsing remains available; the website session is not intentionally revoked.

## Guest shopping and account merge

AsyncStorage key `foliovale.guest-cart.v1` stores product IDs, quantities and the account-bound merge journal. Catalogue data supplies current prices and stock. Quantities are capped at stock and 10; empty-cart delivery is zero, delivery below ₦30,000 is ₦1,500, and delivery is free from ₦30,000.

Guests can add, set and remove items without authentication. The Cart screen explains: **Sign in to save and sync this cart across devices.** Prices are not persisted; catalogue failures preserve stored guest items.

On sign-in, existing account quantities are preserved and guest quantities are merged within the caps. Absolute target quantities are journaled before authenticated cart mutations. A serial queue and checkpoints prevent repeated auth events or ambiguous retries from blindly adding the same quantities twice. Guest storage clears after a successful final cart refetch. Interrupted merges remain bound to the original account.

**Concurrency limitation:** the current API has no conditional-write version or atomic mobile merge endpoint. A second device editing the same item between the last fetch and set can cause a last-write-wins race. Retry safety is not a cross-device transaction.

## Realtime reconciliation

`src/lib/cart-realtime.ts` subscribes to owner-filtered `UPDATE` events on `public.carts`. Signals are debounced for 250 ms, then the authenticated API supplies the current cart. Only one refetch runs at a time; a signal during that fetch schedules a follow-up.

Subscription readiness and foreground return trigger reconciliation. Pull to refresh remains available. Channel errors do not replace a usable cart with a technical error. Sign-out, account changes and unmount remove the old channel and timers. Guests have no channel. The client never reads cart token hashes or writes cart tables directly. The website now has a matching owner-filtered subscription/refetch flow, allowing mobile cart changes to update the website automatically.

## Checkout and recovery

Guests see **Sign in to checkout**; authenticated customers see **Proceed to checkout**. Checkout collects full name, phone, street address, city, state and optional delivery note using the website's validation constraints.

Only **Pay on delivery** is supported. No card details or online payment are needed. Authenticated requests use the existing checkout endpoint and send delivery fields plus a UUID request identifier; prices and user identity are determined by the server.

The pending UUID is stored at `foliovale.checkout-attempt.v1.<user-id>` before submission and reused after network errors, navigation or restart. Delivery details are not persisted locally; after restart they must be re-entered. An already-recorded attempt returns its original order. A lost response does not rotate the UUID.

Success displays the saved reference, total and payment method without claiming payment or dispatch. It refetches the account cart and confirms clearance only when empty. A failed cart refetch preserves the saved order and offers a refresh retry without another checkout mutation. New items from another device are not deleted. Mailgun sandbox restrictions still apply to confirmation email.

## Branding

The canonical mark is [public/favicon.svg](../public/favicon.svg). Launcher, adaptive foreground/background, monochrome, splash and favicon assets use FolioVale navy and the light open-book mark. `app.json` preserves the `foliovale` scheme and `com.lorddan212.foliovale` Android package.

`scripts/generate-brand-assets.cjs` reproduces the assets using the existing root Sharp dependency and writes ignored visual audit output. From the repository root:

```sh
node mobile/scripts/generate-brand-assets.cjs
```

Do not regenerate approved artwork during a build without reviewing the resulting diff.

## Build profiles

| Profile | Distribution/environment | Android output |
| --- | --- | --- |
| development | internal / development | APK with development client, used with Metro |
| preview | internal / preview | APK without development client; intended to launch independently |

The existing EAS project is already linked in `app.json`; do not initialize a replacement. Public configuration comes from the matching EAS environment. Future authorized builds use `npx eas-cli@latest build --platform android --profile development` or `--profile preview`; do not start a duplicate of the preview build currently in progress.

The current preview build's completion and physical QA remain pending at this checkpoint. Internal distribution is not Play Store publication.

## Verification

```sh
npx tsc --noEmit
npm run lint
npm test
npx expo-doctor
```

Also run the root typecheck, tests and website production build. Test clients use controlled responses and do not create production orders. Latest parity results and new device checks are recorded in the [parity report](../docs/implementation/WEB_MOBILE_PARITY.md). Existing development-build device results below predate this patch.

The project owner reports that the development build passed physical-phone Google sign-in, website add → mobile, quantity changes → mobile, removal → mobile and background recovery. These results are not final preview-APK QA.

After the running preview build finishes, install that artifact and verify launcher/splash, startup without Metro or development controls, Google callback, guest persistence/merge, account cart synchronization, background recovery, checkout retry/confirmation and local sign-out. The latest official submission form requires a downloadable APK link, the GitHub/Git repository containing the mobile source and **one single, continuous demonstration video** showing the app working with the existing website, including the required Web ↔ Mobile login and cart synchronization behavior. Upload the final APK to Google Drive or another accessible file-sharing service and confirm reviewers can download it. Provide the repository link after the final branch is pushed under separate authorization. APK upload/link, final-branch repository link, video and submission remain pending. Google Play / App Store publication is not required; the APK download/submission link is required. See the [compliance checklist](../docs/implementation/HNG15_LESSON3_COMPLIANCE.md) for both tasks.
