# FolioVale Mobile

Expo SDK 57, React Native, TypeScript, and Expo Router. The storefront uses the existing FolioVale API. Phase 3 adds Google sign-in through the same Supabase project as the website.

## Run locally

From this directory, run `npm install --include=dev` if dependencies are missing. Copy `.env.example` to `.env` only if you do not already have `.env`, then fill in the Supabase project URL and publishable key. The three public variables are bundled into the app; use only the public project configuration here. Restart Expo after changing them.

Use an Android development build for Google sign-in, then run `npx expo start --dev-client`. Ordinary Expo Go and the web preview can browse but cannot perform this custom-scheme auth flow. Follow [Phase 3 authentication setup](PHASE3_AUTH.md) for the callback configuration and build instructions. The API must be reachable from that device. The default API URL is the production FolioVale website.

The native app is the target. A browser preview may be blocked by the production API's cross-origin policy; a successful web bundle does not prove native behavior or authenticated flows.

## Navigation and behavior

- `src/app/(tabs)/index.tsx`: Shop, public catalogue, prices, stock, refresh and error states.
- `src/app/(tabs)/cart.tsx`: Account cart, quantity changes, removal and server-provided totals.
- `src/app/(tabs)/account.tsx`: Account introduction, real customer details when a session exists, and sign-out.
- `src/providers/shop-provider.tsx`: Session restoration, shared state, auth listener and refresh.
- `src/lib/api-client.ts`: Existing `/api/products`, `/api/session` and `/api/cart` contracts. Private requests require the latest session token and omit cookies. No anonymous mobile cart or automatic mutation retries.
- `src/lib/supabase.ts`: One client; AsyncStorage persists native sessions and foreground activity controls token refresh.

Continue with Google starts Supabase S256 PKCE and opens the system browser. The exact callback is `foliovale://auth/callback`. The SDK exchanges the one-time code with its stored verifier, persists the real session, and triggers customer/cart refresh. Checkout and Realtime remain out of scope; there is no test login.

The website and mobile app share account carts through the existing backend. Pull to refresh reads current data; this phase has no live cart subscriptions. Sign-out calls `supabase.auth.signOut({ scope: 'local' })`. Mobile user/cart state and the persisted mobile session are cleared while public browsing remains available. The website and other devices remain signed in independently; mobile sign-out does not intentionally revoke their sessions.

Native screen branding is FolioVale. The generated launcher icon assets remain from Expo initialization and should be replaced before a distribution build.

## Verification

Run `npx expo-doctor`, `npx tsc --noEmit`, `npm run lint`, and `npm test` here. API-client tests run locally with controlled responses and do not alter production data. Also run the root website's typecheck, tests and build. Device and live authentication checks are separate from these commands.
