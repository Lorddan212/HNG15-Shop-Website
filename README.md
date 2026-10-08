# FolioVale

## Overview

FolioVale is a notebook and planner shop with a Next.js website and an Expo Android app. Both use the same Supabase account system, catalogue, cart backend and checkout service. The catalogue has 53 products: 25 notebooks, 18 planners and 10 sets.

## Live Website

<https://lorddan212-hng15-shop-website.vercel.app>

## Lesson 3 Mobile App

The mobile counterpart lives in [mobile/](mobile/README.md). Google sign-in and website-to-mobile cart changes have passed physical-phone checks in the development build, as reported by the project owner. The preview APK build was running at this cleanup checkpoint; its completion and final physical-device validation are not yet confirmed. The APK download link, final-branch repository link, single continuous demonstration video and submission remain pending.

## Features

### Website

- Browse, search, filter, sort and paginate the collection; open product details.
- Build a guest cart, sign in with Google, and use an account cart.
- Enter delivery details and place Pay on Delivery orders.
- View orders, retry eligible confirmation emails and hide an order from personal history. Hiding does not cancel an order or delete the transaction record.

### Mobile

- Shop, Cart and Account tabs, plus checkout and authentication callback routes.
- Persistent guest shopping with quantity/stock limits and an account-bound merge journal.
- Google authentication, persistent sessions and local-only sign-out.
- Authenticated checkout, saved-order confirmation, My orders and removal from visible history.
- Realtime notifications followed by account-cart refetch, with foreground recovery; the website now subscribes too for automatic cart synchronization in both directions.

### Shared Web/Mobile Behavior

The same Google identity in the same Supabase project resolves the same user UUID and account cart. Catalogue, stock, pricing and order persistence use the existing backend. Pay on Delivery is the only supported payment method.

## Architecture

| Layer | Implementation |
| --- | --- |
| Website | Next.js 16 App Router, React 19, TypeScript, CSS |
| Mobile | Expo SDK 57, React Native 0.86, Expo Router, TypeScript |
| Backend | Existing Next.js route handlers under `app/api/` |
| Data and identity | Supabase PostgreSQL, RLS and Google OAuth |
| Cart notifications | Supabase Realtime; API refetch supplies authoritative cart data |
| Confirmation email | Mailgun, retained from Lesson 2 |

Mobile reuses the production website API; there is no second backend or separate mobile user store. Protected mobile requests send the current Supabase Bearer token. The server verifies identity; invalid supplied Bearer credentials never fall back to browser cookies.

## Authentication

Website authentication uses Supabase cookie sessions and the existing `/auth/callback` route. Native Google sign-in opens the system browser through Expo WebBrowser and uses Supabase S256 PKCE. The exact mobile callback is:

```text
foliovale://auth/callback
```

The SDK exchanges the validated one-time code with its stored verifier and persists the real session in AsyncStorage. Callback identity fields are never trusted. Mobile sign-out uses `supabase.auth.signOut({ scope: 'local' })`, so it does not intentionally revoke the website session.

Keep the mobile callback in Supabase's allowed Redirect URLs alongside the website callbacks. Google's existing Web OAuth client returns to `https://qolxxboicrhhrunfljbj.supabase.co/auth/v1/callback`; the mobile scheme is not a Google Cloud Web-client redirect. See the [mobile guide](mobile/README.md#authentication).

## Cart Architecture

- **Guest website cart:** a random HttpOnly cookie identifies a database cart; only its token hash is stored.
- **Guest mobile cart:** AsyncStorage stores product IDs, quantities and merge progress. Current catalogue data supplies prices and stock.
- **Account cart:** the verified Supabase UUID identifies one server cart across web and mobile. Guest quantities merge into existing account quantities, capped by stock and 10 per product.
- **Mobile merge retry safety:** absolute target quantities and progress are persisted before mutations; repeated auth events do not blindly add quantities again. Concurrent edits from another device during a merge remain a last-write-wins boundary; see the mobile guide.
- **Synchronization:** authenticated website and mobile clients subscribe to owner-filtered cart metadata updates. A Realtime signal triggers a debounced authenticated API refetch. The website serializes cart reads and discards older snapshots during its own mutations; tab focus/visibility and mobile foreground reconciliation recover missed events. Guest carts have no Realtime subscription.

Delivery costs ₦1,500 below ₦30,000 and is free at or above ₦30,000. Empty carts have no delivery fee.

## Checkout and Orders

Checkout requires authentication and collects full name, phone, street address, city, state and an optional delivery note. Pay on Delivery is supported; no online payment is collected at checkout. Online payment is unavailable.

The server calculates prices, delivery fees and stock changes in the checkout transaction. A retained request UUID makes retries return the same saved order. Orders retain item/price snapshots and are restricted to their owner. My orders on both clients reads the same backend history. Mobile lists/details refetch on navigation and pull-to-refresh. Delete from history removes only the visible entry, without cancellation or stock restoration; the other client sees the change on its next history refresh/navigation. Mobile confirmation shows the reference and server total, then refetches the cart; it confirms clearance only after an empty response.

Mailgun failures do not erase saved orders. The configured sandbox can send only to authorized recipients until a verified sending domain is used. Mailgun acceptance does not establish inbox delivery. Email is inherited Lesson 2 functionality, not a Lesson 3 requirement.

The software does not establish physical fulfilment capability: delivery operations and supplier/stock specifications need business verification before commercial fulfilment. Customer copy does not promise dispatch, payment receipt or delivery dates.

## Catalogue

The database supplies 53 products: 25 notebooks, 18 planners and 10 sets. `lib/catalog.ts` is the website's fallback catalogue. Product IDs/slugs remain stable. All 21 corrected descriptions match the live database, verified by a read-only comparison. Existing illustrations/specifications do not constitute independent verification of physical merchandise.

## Environment Variables

Never commit private environment files. Examples contain blank placeholders, except public service URLs. Public variables are bundled into clients; they must never contain private credentials.

### Root web environment

Copy `.env.example` to `.env.local` only for a new checkout; preserve an existing file.

| Variable | Purpose |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Shared Supabase project URL |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Public client key |
| SUPABASE_SECRET_KEY | Server-only Supabase secret/service-role credential |
| MAILGUN_API_KEY | Server-only email sending credential |
| MAILGUN_DOMAIN | Sending domain or sandbox domain |
| MAILGUN_FROM | Sender configured for that domain |
| MAILGUN_API_BASE_URL | Mailgun US or EU API base URL |

### Mobile public environment

Copy `mobile/.env.example` to `mobile/.env` only if absent.

| Variable | Purpose |
| --- | --- |
| EXPO_PUBLIC_API_BASE_URL | Reachable website API base URL |
| EXPO_PUBLIC_SUPABASE_URL | Same Supabase project as the website |
| EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Same project's public client key |

Cloud builds use their selected EAS environment. No private web keys belong in mobile configuration. Restart Metro after local environment changes; bundled configuration changes require a new appropriate release artifact.

## Local Development

Use a Node.js release supported by both installed frameworks and the committed lockfiles.

### Website

```sh
npm ci --include=dev
npm run dev
```

Open <http://localhost:3002>. The development script binds to 127.0.0.1; a physical phone cannot reach that address on your computer. Mobile normally uses the production API.

### Mobile

```sh
cd mobile
npm ci --include=dev
npx expo start --dev-client
```

Open the installed development build. Custom-scheme Google authentication requires a native build; ordinary Expo Go is not the authentication target. Native setup and routes are in [mobile/README.md](mobile/README.md).

## Testing

From the root:

```sh
npm run typecheck
npm test
npm run build
```

From `mobile/`:

```sh
npx tsc --noEmit
npm run lint
npm test
npx expo-doctor
```

The current parity checkpoint has 49 root tests, 104 mobile tests and Expo Doctor 21/21. These counts are checkpoint evidence, not fixed requirements; see [parity verification and remaining device checks](docs/implementation/WEB_MOBILE_PARITY.md). Earlier cleanup results remain historical checkpoint evidence.

Optional isolated SQL verification uses `tests/database-runner.mjs` and PGlite under ignored `output/db-check`. It never loads production environment files or contacts Supabase:

```sh
npm install --prefix output/db-check --cache output/npm-cache --no-save --package-lock=false --ignore-scripts --no-audit --no-fund @electric-sql/pglite
node tests/database-runner.mjs
```

Automated checks do not replace final preview-APK, real-device or email-inbox verification.

## Supabase Migrations

Read-only remote inspection confirms the following local and remote migration versions are aligned:

| Filename | Purpose |
| --- | --- |
| `20261001113845_foliovale_shop_schema.sql` | Original shop schema |
| `20261001122703_foliovale_catalog.sql` | Initial catalogue |
| `20261001163535_expand_foliovale_catalog_53_products.sql` | Expanded catalogue |
| `20261005100819_order_history_deletion.sql` | Hide orders from customer history |
| `20261005110000_shared_account_carts.sql` | Shared account carts and notification metadata |
| `20261006000100_catalog_description_corrections.sql` | 21 corrected descriptions |

All six are recorded remotely; the catalogue corrections are live. No history repair or replay of these migrations is needed. This cleanup performs no database writes. Future changes require new reviewed migrations; preserve historical SQL.

## EAS Builds

`mobile/eas.json` has two internal Android APK profiles:

| Profile | Environment | Behavior |
| --- | --- | --- |
| development | development | Development client; connects to Metro |
| preview | preview | No `developmentClient`; intended for standalone use without Metro |

The current preview build was reported running when cleanup began. No build was started, stopped or changed during this work. After completion, install the resulting APK and verify launch/icon/splash, absence of development UI, authentication, cart sync and checkout. Do not infer preview QA from development-build results. See [mobile build guidance](mobile/README.md#build-profiles).

## HNG Lesson 3 Compliance

The latest official submission form supplied by the project owner supersedes earlier guide wording for submission requirements.

**Task One requires:** a reviewer-accessible APK download link (Google Drive or another accessible file-sharing service), the GitHub/Git repository containing the mobile source, and **one single, continuous video** demonstrating the mobile app working with the existing website, including the required Web ↔ Mobile login and cart synchronization behavior.

| Requirement | Status | Evidence / remaining action |
| --- | --- | --- |
| Mobile counterpart | Complete | Expo routes and existing shopping flows |
| Same backend/API | Complete | Mobile client uses existing website routes |
| Same authentication/account | Complete | Shared Supabase project and Google provider |
| Web → mobile cart synchronization | Complete | Owner-reported development-build add, quantity and removal checks passed |
| Physical-phone testing | Complete using development build | Owner-reported Google sign-in and cart checks |
| Launchable FolioVale icon | Complete in development build | Native configuration and canonical FolioVale assets |
| Clean preview APK build | In progress / pending completion | Current build completion not confirmed |
| Final preview APK physical QA | Pending | Install and test the final artifact |
| APK download link | Pending until final APK is uploaded | Upload and confirm reviewer download access |
| Repository link | Available after final branch is pushed | Provide the repository/branch containing final mobile source and reviewer access |
| Single continuous demonstration video | Pending | Show mobile + website, login and cart synchronization in one uninterrupted recording |

**Task Two requires:** the PR link in the team's project and a screenshot/picture showing the submission.

| Requirement | Status |
| --- | --- |
| Team PR | Pending; no completion evidence recorded |
| PR link | Pending |
| Submission screenshot/picture | Pending |

The [detailed compliance checklist](docs/implementation/HNG15_LESSON3_COMPLIANCE.md) records evidence and remaining actions. Google Play / App Store publication is not required; the **APK download/submission link is required**. Mailgun is not required for Lesson 3. Advanced Realtime is optional and implemented. Task Two is not complete without the required evidence.

## Deployment

The website is hosted on Vercel. Future deployments need the server environment variables, matching Supabase project and appropriate website OAuth callbacks. Android artifacts use the existing EAS project and selected profile/environment. Deployment, cloud-variable changes and builds are separate authorized actions; none is performed by this cleanup.

## Project Structure

```text
app/                   Website pages and existing API routes
components/            Website UI and shared shop state
lib/                   Auth, commerce, catalogue, email and repository code
public/                Website artwork and canonical favicon
mobile/                Expo app, native configuration and focused tests
supabase/migrations/   Six aligned SQL migrations
tests/                 Website and isolated database tests
docs/implementation/   Current compliance and cleanup reports
docs/history/          Clearly labelled development checkpoint records
```

[PRD.md](PRD.md) defines product scope. [AGENTS.md](AGENTS.md) and [mobile/AGENTS.md](mobile/AGENTS.md) define contributor constraints. Historical reports are retained for provenance and are not current setup instructions.
