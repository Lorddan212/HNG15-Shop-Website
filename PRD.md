# FolioVale — Product Requirements

## Product and scope

FolioVale provides a notebook/planner storefront on the web and Android. Customers browse one catalogue, build a cart, use Google sign-in and place Pay on Delivery orders through a shared backend. The mobile counterpart satisfies the Lesson 3 individual implementation requirements; the team's Zedu work is a separate deliverable.

## Catalogue and browsing

The catalogue contains 53 products: 25 notebooks, 18 planners and 10 sets. Product identifiers, prices, stock, descriptions and specifications come from the existing data. The website supports search, categories, sorting, pagination and detail pages; mobile provides catalogue browsing and cart controls. Preserve the website fallback catalogue for resilience.

Do not invent customer counts, ratings, reviews, provenance, certifications, guarantees or delivery speeds. Existing physical specifications still require independent business validation before fulfilment.

## Identity and account

Use the same Supabase project and Google provider on both platforms. Mobile validates its native PKCE callback and persists the real session. Website cookie authentication and mobile Bearer authentication resolve the same verified user UUID. Mobile sign-out is local to its session. Protected orders remain owner-scoped.

## Carts

Website guests use a database cart identified by a hashed cookie token. Mobile guests use AsyncStorage product/quantity records, priced from the current catalogue. Account carts persist on the server and are shared by both clients.

Quantity changes respect stock and a maximum of 10 per product. Guest mobile merges preserve existing quantities, persist retry progress and clear guest state only after success. Concurrent same-item edits during a merge retain the documented last-write-wins limitation.

Both clients use authenticated Realtime notifications to trigger authoritative API refetches. Browser focus/visibility, mobile foreground recovery and manual refresh reconcile missed notifications. No cart table writes or token-hash reads are allowed from mobile.

Delivery is ₦1,500 below ₦30,000, free from ₦30,000 and zero for empty carts.

## Checkout and orders

Require authentication and collect full name, phone, street address, city, state and optional delivery note. Support Pay on Delivery only. No online payment is collected; online payment remains unavailable.

The server validates delivery data and computes prices, delivery and stock changes in one transaction. Request UUIDs provide idempotency. Orders retain customer, delivery, quantity and price snapshots. Confirmation displays the saved reference and total without claiming payment or dispatch.

Both website and mobile customers can view My orders and hide their own entries without cancelling the order, restoring stock or deleting the underlying transaction. Mobile lists/details use the existing backend and refresh on navigation or pull-to-refresh; no fourth tab or local order database is added.

Mailgun sends HTML/plain-text confirmations with bounded retries. Email failure must not invalidate the saved order. Sandbox recipient restrictions apply until a verified sending domain is configured. Email is inherited Lesson 2 functionality, not a Lesson 3 acceptance requirement.

## Technology and security

- Next.js 16, React 19, TypeScript and CSS for the website.
- Expo SDK 57, React Native and Expo Router for mobile.
- Existing Next.js routes and Supabase PostgreSQL/Auth for both clients.
- Verify protected identities server-side; invalid supplied Bearer tokens cannot fall back to cookies.
- Preserve browser origin checks and guest-cookie ownership.
- Keep server credentials private; public mobile variables contain no server secrets.
- Preserve RLS, stock locks, checkout idempotency and order snapshots.
- Use Realtime only as a signal; the API remains the cart source of truth.

## Acceptance and release

Automated checks cover authentication, ownership, cart/merge behavior, checkout retries and Realtime reconciliation. Root typecheck/tests/build and mobile typecheck/lint/tests/Expo Doctor must pass.

The owner reports development-build physical-phone authentication, cart updates/removal and background recovery passed. Final preview-APK validation and submission remain pending. The latest official form requires an accessible APK download link, the repository containing the mobile source after the final branch is pushed, and a single continuous video demonstrating mobile and website login/cart synchronization. Task Two requires a team/project PR link and a submission screenshot/picture; completion is unverified. The running build must finish before its artifact can be assessed.

The [root README](README.md) records current deployment, migration and verification status. The [Lesson 3 compliance matrix](docs/implementation/HNG15_LESSON3_COMPLIANCE.md) separates required submission evidence, optional enhancements and pending team work.

## Outside current scope

Online payment gateways, store publication, admin tooling, new backends and changes to physical delivery operations are outside this product version. No software result establishes real inventory fulfilment, shipment or delivery guarantees.
