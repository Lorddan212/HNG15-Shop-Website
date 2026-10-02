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

Next.js App Router, React, TypeScript, plain CSS, Supabase PostgreSQL/Auth, and Mailgun's HTTP API. No payment gateway is needed for this version.

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

The schema and catalogue migrations in `supabase/migrations/` have been applied to this project. Do not run them again on that same database. Apply them in filename order only when setting up a new empty project.

Tables: `products`, `carts`, `cart_items`, `profiles`, `orders`, and `order_items`.

All tables have RLS enabled. Bag tables intentionally have no browser policies and no browser-role privileges: requests go through the server using a hashed bag token. Other browser reads are limited to active products and the authenticated user's own profile/orders. Mutation functions can only be called by the server role.

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
9. Test the shop's **Continue with Google** button. Confirm the signed-in account appears and can view its orders.

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

The guest bag follows its browser cookie. It is not automatically merged across browsers or devices. Order history follows the signed-in account. Recent history shows up to 50 orders.

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

## Deploy

The project owner handles deployment. For Vercel, import the private GitHub repository using the Next.js preset, configure all environment variables, and deploy. Never upload `.env.local`. Configure the final Google/Supabase redirect URLs before testing authentication on the live site.

No deployment or GitHub push has been performed for this shop during development.

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
