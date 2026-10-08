# FolioVale Phase 3: mobile Google authentication

> Historical development record — current project status is documented in [README.md](../../README.md).
> This records an earlier checkpoint, not current release instructions. Migration history is now aligned and the 21 catalogue corrections are live. See the [current compliance checklist](../implementation/HNG15_LESSON3_COMPLIANCE.md) for device and release status.

The app uses the same FolioVale Supabase project as the website: `qolxxboicrhhrunfljbj`. No provider settings, external resources, signing credentials, commits, pushes, deployments or store publications were created or changed in this phase.

## Required Supabase setting

In the existing project's **Authentication → URL Configuration → Redirect URLs**, add and save exactly:

```text
foliovale://auth/callback
```

Keep the current website Site URL and all existing website/local callback entries. Do not replace the Site URL with the mobile scheme or add a wildcard. The app intentionally uses a fixed redirect without dynamic query parameters.

## Google Cloud

Reuse the existing Google provider and Web application OAuth client. Google returns to Supabase; Supabase returns to the app. Retain this Authorized redirect URI in the existing Google client:

```text
https://qolxxboicrhhrunfljbj.supabase.co/auth/v1/callback
```

If website Google sign-in already works with this project, no Google client change should be required. This browser-based flow needs no new Android OAuth client, SHA fingerprint, mobile client secret or JavaScript origin. Do not add the custom mobile scheme to Google Cloud's Web client redirect list. If the consent screen is in Testing, the Google account used on the phone must be an allowed test user. Cloud settings were not inspected or changed during this phase.

## Android development build

The app scheme and native modules require a new development build. Ordinary Expo Go and the web preview cannot perform this authentication flow. No APK has been built or installed; the verified JavaScript export is not an APK.

The Android package identifier is `com.lorddan212.foliovale`. The minimal `eas.json` profile enables a development client, internal distribution, the development environment and an Android APK. No EAS project ID or owner was invented.

### Local build on Windows

With Android Studio and its SDK/JDK configured, connect an emulator or a USB-debugging-enabled Android phone. From the shop repository:

```powershell
cd mobile
npm install --include=dev
npx expo run:android --device
```

Expo generates native files when required; do not edit the generated Android folder manually. Subsequent JavaScript development uses:

```powershell
npx expo start --dev-client
```

### Optional EAS cloud build

From `mobile/`, use your own Expo account and link/create the EAS project yourself when prompted:

```powershell
npx eas-cli@latest login
npx eas-cli@latest init
```

In the EAS project's **Environment variables**, select **development** and add these three public values with **Plain text** visibility:

- `EXPO_PUBLIC_API_BASE_URL`: `https://lorddan212-hng15-shop-website.vercel.app`
- `EXPO_PUBLIC_SUPABASE_URL`: `https://qolxxboicrhhrunfljbj.supabase.co`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: copy the existing public publishable key locally from `mobile/.env`.

The ignored local `.env` is not a reliable way to configure a cloud build. Do not upload the website's private environment files or paste credentials into chat.

```powershell
npx eas-cli@latest build --platform android --profile development
```

Review project/signing prompts yourself. Download and install the resulting APK, run `npx expo start --dev-client`, and connect the phone to Metro, normally on the same Wi-Fi network. Internal distribution does not publish to Google Play. Rebuild after changing a native dependency or the scheme.

## Authentication and identity

1. Account calls `supabase.auth.signInWithOAuth` with Google, `skipBrowserRedirect: true`, and the exact native redirect produced by `makeRedirectUri`.
2. Supabase generates a verifier, S256 challenge and flow identifier. Expo Crypto supplies missing native random/digest primitives. Unexpected authorization hosts, redirects and plain challenges are rejected before opening the browser.
3. `WebBrowser.openAuthSessionAsync` opens the Supabase authorization URL. Google authenticates the real account through the existing provider.
4. The browser result or Router callback supplies a one-time code. The coordinator validates the callback target and pending attempt. It rejects unsolicited, expired, malformed and token-fragment callbacks and deduplicates repeated deliveries. Raw callback URLs are never logged or persisted.
5. `exchangeCodeForSession(code, { flowId })` uses the installed SDK's matching verifier slot. The SDK saves the real server-returned session and emits `SIGNED_IN`. URL identity fields never become a user.
6. ShopProvider reloads `/api/session` and `/api/cart`. The existing API client obtains the current access token for each protected request; the backend verifies it and resolves the cart by Supabase UUID.

The same Google provider identity in this same Supabase project resolves to the existing user UUID. A different Google account is a different identity. There is no mobile user table or email-based identity shortcut. Local checks confirmed the web/mobile project URLs match; equality of the real web/mobile UUID still needs physical-device verification.

Native AsyncStorage persistence, automatic refresh and foreground/background handling remain enabled. `detectSessionInUrl` remains false because callbacks are handled explicitly. A pending attempt can resume after app termination within 15 minutes, subject to Supabase's code expiry.

Sign-out calls `supabase.auth.signOut({ scope: 'local' })`. It clears the mobile user/cart and persisted mobile session while keeping public browsing available. Only the current mobile session is revoked; the website and other devices can remain signed in independently with the same account. Website auth code and its callback remain unchanged.

## Physical-device checks remaining

- Add the exact Supabase redirect, build and install the APK.
- Use the same Google account as the website; confirm return to Account with real name/email.
- Compare the authenticated `/api/session` user ID on both clients without sharing tokens or customer data in chat.
- Add/change/remove cart items and refresh both clients. No Realtime behavior is expected.
- Force-close/reopen after sign-in and verify session persistence.
- Cancel sign-in and retry; test consent denial and a network failure.
- Test return while backgrounded and after process termination during sign-in.
- Sign out on mobile, confirm Account/Cart are signed out while Shop works, then reopen to verify mobile persistence was cleared. Confirm the website remains signed in, including after refreshing its session.

Unit tests use controlled responses and the real installed Supabase SDK. They do not authenticate a real Google account. Checkout and Realtime remain outside this phase.

## References

- [Supabase Google provider](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase PKCE and verifier slots](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Expo AuthSession](https://docs.expo.dev/versions/v57.0.0/sdk/auth-session/)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
