# FolioVale

A notebook and planner shop presented under the FolioVale brand. FolioVale combines a blue-and-paper storefront with database-backed bags, Google sign-in, pay-on-delivery checkout, order history, and Mailgun confirmation emails.

## What the shop does

- Browse 53 pieces: 25 notebooks, 18 planners, and 10 sets.
- Filter by category, search products, sort by price/name, paginate, and view product details.
- Add, update, and remove bag items.
- Keep bags in Supabase across page refreshes using a secure browser cookie.
- Sign in with Google through Supabase Auth and Google Cloud Console.
- Place a test order with delivery details and pay-on-delivery status.
- Save orders, item-price snapshots, stock changes, customer details, and email status.
- View only the signed-in customer's order history.
- Send confirmation emails with bounded retries if email delivery is temporarily unavailable.

FolioVale currently uses professional pre-launch branding. Checkout is in testing: payments and shipments are not active. Catalogue illustrations and specifications are sample product content and must be checked against actual stock before launch.

## Stack

Next.js App Router, React, TypeScript, plain CSS, Supabase PostgreSQL/Auth, and Mailgun's HTTP API. Pay on delivery is the active payment method. Online payment is shown as a planned option but is not enabled, because payment gateway integration is optional for this task.

## Run locally

Use a maintained Node.js version supported by the installed Next.js release (Node.js 22 or newer is recommended for this project).

```sh
npm install
npm run dev
```

Open [http://localhost:3002](http://localhost:3002). The development server binds to the local machine only.

Copy `.env.example` to `.env.local` for a new checkout. The current working copy already has `.env.local` with the public Supabase connection values. Enter private values in that file; never paste them into chat or commit them.

| Variable | Purpose |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Public client key |
| SUPABASE_SECRET_KEY | Server-only Supabase secret or legacy service-role key |
| MAILGUN_API_KEY | Server-only Mailgun sending key |
| MAILGUN_DOMAIN | Verified sending domain or Mailgun sandbox domain |
| MAILGUN_FROM | Sender, e.g. FolioVale <orders@your-sending-domain> |
| MAILGUN_API_BASE_URL | <https://api.mailgun.net> or <https://api.eu.mailgun.net> |

Restart the development server after changing environment variables if changes are not picked up automatically. A catalogue preview is shown while the database connection is incomplete; ordering stays disabled and no success is simulated.

## Supabase

Project: [FolioVale Shop](https://supabase.com/dashboard/project/qolxxboicrhhrunfljbj), in the connected Daniel Jegbefumhen organization, region `eu-west-1`. Supabase reported a project cost of $0/month at creation.

The original schema/catalogue migrations and `202610050001_order_history_deletion.sql` have been applied to this project. The Task 3 migration `202610050002_shared_account_carts.sql` is prepared but NOT applied. Do not rerun earlier migrations on this database. Apply all migrations in filename order only when setting up a new empty project.

Tables: `products`, `carts`, `cart_items`, `profiles`, `orders`, and `order_items`.

All tables have RLS enabled. After the Task 3 migration, authenticated users may read only their own account-cart metadata and items. Cart token hashes remain server-only; guests have no direct database access. Every cart write continues through the trusted backend. Other browser reads remain limited to active products and the authenticated user's own profile/orders. Mutation functions can only be called by the server role.

## Google sign-in setup

1. Select the existing [FolioVale Shop Google Cloud project](https://console.cloud.google.com/auth/overview?project=deductive-mix-510317-v1). Project ID: `deductive-mix-510317-v1`. Its OAuth app branding has been created.
2. Open Google Auth Platform. Configure Branding, Audience, and the basic email/profile permissions. During testing, add the Google accounts that will sign in as test users.
3. Under Clients, create an OAuth client of type **Web application**.
4. Add `http://localhost:3002` as an authorized JavaScript origin for local development. Add the final HTTPS shop origin when deployed.
5. Add this **authorized redirect URI**:
   `https://qolxxboicrhhrunfljbj.supabase.co/auth/v1/callback`
6. In [Supabase Auth providers](https://supabase.com/dashboard/project/qolxxboicrhhrunfljbj/auth/providers), enable Google and enter the Google client ID and client secret there. The Google secret belongs in Supabase, not in public app code.
7. In Supabase Authentication → URL Configuration, set the local Site URL to `http://localhost:3002` and add `http://localhost:3002/auth/callback` to allowed redirect URLs. If using `127.0.0.1`, add that exact callback origin too.
8. After deployment, update Site URL to the production URL and add the production `/auth/callback` URL.
9. For this project in Supabase Authentication → URL Configuration, set the Site URL to:
   `https://lorddan212-hng15-shop-website.vercel.app`

   Keep the local development callback URLs in the allowed Redirect URLs:
   - `http://localhost:3002/auth/callback`
   - `http://127.0.0.1:3002/auth/callback`
   - `https://lorddan212-hng15-shop-website.vercel.app/auth/callback`

10. In Google Cloud, keep the Supabase OAuth callback as the authorized redirect URI:
   `https://qolxxboicrhhrunfljbj.supabase.co/auth/v1/callback`

   Add the production FolioVale URL as an authorized JavaScript origin where applicable.
11. Test the shop's **Continue with Google** button. Confirm the signed-in account appears and can view its orders.

Reference: [Supabase Google authentication guide](https://supabase.com/docs/guides/auth/social-login/auth-google).

## Mailgun setup

1. In Mailgun, open Sending → Domains and select a sending domain.
2. For a pre-launch email test, use the sandbox domain and add/verify each test recipient. A sandbox cannot send to arbitrary unverified addresses.
3. For unrestricted customer recipients, use your own domain and complete Mailgun's DNS verification.
4. Save the sending key, domain, sender, and correct US/EU API endpoint in `.env.local`.
5. Place a test order using a Google account whose email is authorized for the sandbox. Confirm the message arrives in its inbox.

Emails use the authenticated account email, not an arbitrary client-supplied recipient. Order status survives email failures. `accepted` means Mailgun accepted the message, not that an inbox received it. Retry requests are limited to three attempts per order, at least one minute apart. Ambiguous `sending` states require manual investigation rather than an automatic resend.

Reference: [Mailgun send-email API](https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages/post-v3--domain-name--messages).

## Checkout rules

All prices use integer kobo. Delivery is ₦1,500 below ₦30,000 and free from ₦30,000. Quantities are limited to 10 of each product and available stock.

Checkout locks the relevant bag and stock rows, calculates totals from stored prices, records the order/items/profile, decrements stock, and clears the bag in one transaction. The customer ID and email come from verified authentication. Duplicate requests with the same request ID return the existing order. New orders are limited to five per account in a ten-minute window.

The guest bag follows its browser cookie. With Task 3 Phase 1 and its migration, sign-in merges that guest bag into one account bag shared across authenticated devices. Reload or refetch to see changes on another device; realtime subscriptions come later. Order history follows the signed-in account. Recent history shows up to 50 orders.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

The test runner uses TypeScript compilation and Node's built-in test runner. It covers API validation, authentication/ownership, same-origin requests, totals, failure handling, and the Mailgun request shape. Database tests are run separately in a transaction that rolls back test records.

Verified locally on 1 October 2026:

- Production build completed, including TypeScript checks; all 22 automated tests passed.
- Browser review covered the desktop storefront, mobile catalogue, category filters, pagination, and empty search results. The mobile hero typography was refined after review.
- Live HTTP checks on both localhost and 127.0.0.1 verified the 53-product catalogue, adding two bag items, persistence across requests, removal, and rejection of foreign-origin requests.
- Database transaction tests verified order totals, stock, idempotency, profile persistence, bag clearing, and email claims with rollback.

The request-origin guard compares the browser origin with the incoming Host and request protocol, because Next.js can normalize its internal request URL to localhost. Foreign origins remain blocked.

Google sign-in is connected: the Google provider is enabled, the local Site URL is <http://localhost:3002>, and callback URLs for localhost:3002 and 127.0.0.1:3002 are saved. On 2 October 2026 the owner confirmed successful Google sign-in and the My orders link.

Mailgun is connected using the US API endpoint and a verified sandbox recipient. On 2 October 2026, an end-to-end checkout test successfully created an order, Mailgun accepted and delivered the confirmation message, and the confirmation email was received in Gmail. Because the project currently uses a Mailgun sandbox domain, confirmation emails can only be delivered to authorized sandbox recipients until a custom sending domain is configured.

Production verification on 2 October 2026:

- FolioVale was successfully deployed to Vercel.
- Google OAuth was verified on the production domain.
- Multiple products could be added, updated, removed, and carried through checkout.
- Checkout successfully persisted orders in Supabase.
- Order history remained available after sign-out and later sign-in.
- Mailgun confirmation email delivery was verified using an authorized sandbox recipient.

## Deploy

The project owner handles deployment. For Vercel, import the private GitHub repository using the Next.js preset, configure all environment variables, and deploy. Never upload `.env.local`. Configure the final Google/Supabase redirect URLs before testing authentication on the live site.

The project is deployed from the `main` branch of the GitHub repository to Vercel at:
<https://lorddan212-hng15-shop-website.vercel.app>

## Files

- `app/`: storefront routes, checkout, orders, API endpoints, and styles.
- `components/`: interface components and shared shop state.
- `lib/`: validation, commerce logic, Supabase clients, repository, and email.
- `supabase/migrations/`: schema and catalogue.
- `tests/`: API and business tests.
- `AGENTS.md`: rules for future AI-assisted work.
- `public/favicon.svg`: shop icon.

## Development notes

FolioVale was built with Codex assistance. The app itself does not call an AI service. The name is a project brand; no trademark registration or exclusivity is claimed.

## Editorial image

The built-in image-generation tool created `public/images/hero-editorial.png` for the storefront. Prompt: a photorealistic luxury stationery still life with three navy, dusty-blue, and parchment clothbound notebooks, restrained brass foil, a fountain pen, blue stone, soft side lighting, and no text or watermark. Catalogue illustrations remain original code-rendered covers.

## Account navigation and removing orders

General sign-in returns to the home page. Checkout and the orders page retain their explicit sign-in destinations. Signed-in customers can sign out from the shared header on every page.

`DELETE /api/orders/{id}` removes an order from the verified owner's visible history. It requires a same-origin request and no body. Success returns `200 {"deleted":true}`; signed-out requests return 401, missing/foreign origins 403, invalid IDs or absent/other-owner/already-deleted orders 404, and database failures 503. The server never accepts a customer ID from the browser.

Customers confirm **Delete from history** before removal. This stores `deleted_at` in Supabase and hides the order from history, detail pages and email retries. It does not cancel an order, restore stock, erase accounting snapshots, or permit an old checkout request to create another order. Migration `202610050001_order_history_deletion.sql` was applied to the FolioVale Supabase project on 5 October 2026. Apply it when upgrading other databases.

Verification on 5 October 2026 for these account changes: TypeScript passed, all 28 automated tests passed, and the production build passed. Supabase transaction tests passed for ownership, repeated removal, hidden order/item reads through RLS, retained snapshots, unchanged stock and checkout idempotency; all test data was rolled back. Local HTTP checks returned 401 for signed-out deletion and 403 for foreign-origin deletion. This website version has not been committed, pushed or deployed.

OAuth uses the exact registered `/auth/callback` URL. A short-lived, same-site `fv_auth_next` cookie stores only an allowlisted destination (`/`, `/checkout` or `/orders`) and is cleared by the callback. This avoids Supabase rejecting callback URLs with additional query parameters.

## Pre-release technical reconciliation review

SDK 57 patch alignment is complete: Expo Doctor passes 21/21, mobile TypeScript/lint and 84 tests pass, and root typecheck, 39 tests and the website production build pass (7 October 2026). React, application behavior and approved branding/EAS settings are unchanged.

The read-only migration comparison and proposed history reconciliation are recorded in [MIGRATION_RECONCILIATION.md](MIGRATION_RECONCILIATION.md). All shared-cart implementation objects are verified. The five customer policies target authenticated in both committed local SQL and the live database; the prior policy-drift claim is withdrawn. No database changes or history repairs were executed. The report supersedes earlier incomplete migration-status notes while retaining their historical context.

## Final pre-build checkpoint (6 October 2026)

The catalogue description correction is prepared as `supabase/migrations/202610060001_catalog_description_corrections.sql` and has **not been applied**. It updates only 21 descriptions, guarded by stable product UUID, slug and previous text. The loose correction SQL has been removed.

A read-only inspection found that the first four local migration timestamps differ from the four recorded remote versions. The shared-cart migration is absent from remote history, although its account-cart column and resolver function already exist. There is no local Supabase CLI configuration or link metadata. Do not assume a later `db push` will apply only the catalogue correction: reconcile migration history before any authorized push; do not replay existing schema migrations. This live inspection supersedes the older Phase 1 migration-status notes below. Full version mapping and limitations are in [CONTENT_AUDIT.md](CONTENT_AUDIT.md#read-only-migration-history-inspection).

Customer checkout copy now states: “Pay on delivery. No online payment is collected at checkout.” Payment behavior is unchanged. No commit, push, APK build, deployment, database write or EAS environment change was made at this checkpoint.

## Task 3 Phase 1 API contract (pending migration)

The existing endpoints and JSON representations remain in use; no mobile-specific routes or UI are added. `/api/session` returns `{user: Customer | null}` with the same fields for cookie and bearer sessions. Authenticated `/api/cart` and checkout resolve one account cart by verified Supabase user ID; guests retain the hashed `fv_bag` cookie. Browser sign-in merges guest items on the next cart read, write or checkout.

All API routes validate a supplied `Authorization: Bearer <Supabase access token>` against Supabase Auth. Malformed, invalid or expired credentials return 401 even when valid cookies are present. Mutation requests with a validated bearer token do not need Origin. Cookie/guest mutations still require the existing matching Origin/Host/protocol guard. JSON validation, checkout idempotency, order ownership, soft deletion and email retry rules remain unchanged. Clients never supply a user ID, cart token or price.

Migration and release notes are recorded in the Task 3 Phase 1 handoff below. Do not deploy this backend before its new migration is applied.

### Task 3 Phase 1 handoff

See [TASK3_PHASE1.md](TASK3_PHASE1.md) for the complete change list, database details, migration instructions and deployment risks. This phase adds backend support only. The existing `mobile/` folder was left untouched. No commit, push, deployment, new provider resource or Task 3 live migration was performed.

Disposable database verification (never connects to Supabase):

```sh
npm install --prefix output/db-check --cache output/npm-cache --no-save --package-lock=false --ignore-scripts --no-audit --no-fund @electric-sql/pglite
node tests/database-runner.mjs
```

PGlite is used only under ignored verification output; it is not an application dependency. These checks validate PostgreSQL schema, functions, policies and transaction behavior. They do not replace a live Supabase Realtime subscription or multi-connection concurrency test.

Final Phase 1 verification on 5 October 2026: 39 automated tests, TypeScript and the production build passed. Both disposable database scripts passed. Local production-server checks returned 401 for invalid bearer credentials, 200 for anonymous cart reads and 403 for guest writes without Origin. The shared-cart migration remains unapplied, so authenticated cart use with this new local backend requires that migration first.

## Mobile guest shopping and checkout

The mobile client now supports locally persisted guest carts, resumable merging into the existing account cart after Google login, and authenticated pay-on-delivery checkout through the existing API. No website behavior, database migrations, payment integration or Realtime subscription was added. See [mobile behavior, retry semantics and device checks](mobile/README.md#guest-shopping-and-checkout-parity).
