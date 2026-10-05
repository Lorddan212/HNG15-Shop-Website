# FolioVale Mobile

Expo SDK 57, React Native, TypeScript, and Expo Router. Phase 2B connects the mobile storefront to the existing FolioVale API.

## Run locally

From this directory, run `npm install --include=dev` if dependencies are missing. Copy `.env.example` to `.env` only if you do not already have `.env`, then fill in the Supabase project URL and publishable key. The three public variables are bundled into the app; use only the public project configuration here. Restart Expo after changing them.

Run `npx expo start` and open the app on an Android or iOS device with a compatible Expo Go version, or use a simulator/development build for SDK 57. The API must be reachable from that device. The default API URL is the production FolioVale website.

The native app is the target. A browser preview may be blocked by the production API's cross-origin policy; a successful web bundle does not prove native behavior or authenticated flows.

## Navigation and behavior

- `src/app/(tabs)/index.tsx`: Shop, public catalogue, prices, stock, refresh and error states.
- `src/app/(tabs)/cart.tsx`: Account cart, quantity changes, removal and server-provided totals.
- `src/app/(tabs)/account.tsx`: Account introduction, real customer details when a session exists, and sign-out.
- `src/providers/shop-provider.tsx`: Session restoration, shared state, auth listener and refresh.
- `src/lib/api-client.ts`: Existing `/api/products`, `/api/session` and `/api/cart` contracts. Private requests require the latest session token and omit cookies. No anonymous mobile cart or automatic mutation retries.
- `src/lib/supabase.ts`: One client; AsyncStorage persists native sessions and foreground activity controls token refresh.

A fresh installation can browse but cannot sign in yet. Continue with Google is intentionally disabled. Phase 3 or later will implement Google OAuth and callbacks, then separately authorized checkout and Realtime cart subscriptions. Account and cart success paths require a real session; there is no test login in the app.

The website and mobile app share account carts through the existing backend. Pull to refresh reads current data; this phase has no live cart subscriptions. Mobile sign-out signs out this device, not every website session.

Native screen branding is FolioVale. The generated launcher icon assets remain from Expo initialization and should be replaced before a distribution build.

## Verification

Run `npx expo-doctor`, `npx tsc --noEmit`, `npx expo lint`, and `npm test` here. API-client tests run locally with controlled responses and do not alter production data. Also run the root website's typecheck, tests and build. Device and live authentication checks are separate from these commands.
