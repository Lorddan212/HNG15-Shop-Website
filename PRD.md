# FolioVale — Product Requirements Document

## 1. Product Overview

FolioVale is a responsive e-commerce website for notebooks, planners, and stationery sets.

The project demonstrates a complete online shop flow with product browsing, persistent cart management, Google authentication, checkout, database-backed orders, order history, and Mailgun confirmation emails.

The primary goal is to satisfy the HNG 15 Lesson 2 individual shop requirements while maintaining a polished and usable customer experience.

---

## 2. Core Objectives

FolioVale must allow users to:

- Browse and search the product collection.
- Add multiple products to a shopping bag.
- Increase, reduce, or remove product quantities.
- Continue shopping before checkout.
- Sign in securely with Google.
- Enter delivery information.
- Place an order using pay on delivery.
- Receive an email confirmation after checkout.
- View previously placed orders after signing out and signing back in.
- Retain order data through database persistence.

---

## 3. Product Catalogue

The catalogue contains 53 sample products:

- 25 Notebooks
- 18 Planners
- 10 Sets

Users can:

- Browse all products.
- Filter by category.
- Search products.
- Sort products.
- View product details.
- Add available products to the bag.

---

## 4. Shopping Bag

The shopping bag must support:

- Multiple different products.
- Quantity changes.
- Product removal.
- Server-backed persistence.
- Subtotal calculation.
- Delivery fee calculation.
- Total calculation.
- Returning to the collection to add more products before checkout.

Delivery costs ₦1,500 for orders below ₦30,000 and is free for orders of ₦30,000 or more.

---

## 5. Authentication

Authentication is provided through:

- Google OAuth
- Supabase Authentication
- Google Cloud Console

Authenticated users must be able to:

- Sign in.
- Sign out.
- Place orders.
- View only their own orders.
- Sign out, return later, sign in again, and still see previous orders.

---

## 6. Checkout

Checkout collects:

- Full name
- Phone number
- Street address
- City
- State
- Optional delivery note

The currently active payment method is:

- Pay on delivery

Online payment may be displayed as a future option but is not currently enabled.

The server must calculate prices and totals rather than trusting values supplied by the browser.

---

## 7. Order Persistence

Orders are stored in Supabase PostgreSQL.

Each saved order includes:

- Authenticated customer ID
- Customer email
- Delivery information
- Product snapshots
- Quantities
- Item prices
- Subtotal
- Delivery fee
- Total
- Payment method
- Order status
- Email status
- Order reference
- Creation date

Orders must remain available after logout, browser closure, and later sign-in.

---

## 8. Confirmation Email

Mailgun is used to send order confirmation emails after successful checkout.

The confirmation email should contain:

- FolioVale branding
- Customer name
- Order reference
- Ordered products
- Quantities
- Item prices
- Delivery fee
- Total
- Payment method
- Delivery address

Both HTML and plain-text email formats should be provided.

A failure to send email must not delete or invalidate an already saved order.

The current Mailgun sandbox environment can send only to authorized recipients until a custom sending domain is configured.

---

## 9. Technology Stack

- Next.js
- React
- TypeScript
- CSS
- Supabase PostgreSQL
- Supabase Authentication
- Google OAuth
- Mailgun HTTP API
- Git and GitHub
- Vercel for deployment

---

## 10. Security Requirements

The application must:

- Keep private API keys server-side.
- Never commit `.env.local`.
- Validate authenticated users on protected routes.
- Restrict users to their own orders.
- Calculate prices on the server.
- Validate checkout input.
- Use database row-level security where appropriate.
- Protect cart and checkout mutations against invalid requests.
- Preserve order integrity if email delivery fails.

---

## 11. Testing Requirements

Before submission:

- TypeScript checks must pass.
- Automated tests must pass.
- Production build must succeed.
- Google sign-in must work.
- Cart operations must work.
- Multiple products must be supported.
- Checkout must create a persistent order.
- Confirmation email must be received.
- Order history must survive logout and re-login.
- Production deployment must be tested end-to-end.

```sh
npm run typecheck
npm test
npm run build
```

---

## 12. Deployment

  The application is deployed to Vercel at:

<https://lorddan212-hng15-shop-website.vercel.app>

  Production deployment must include:

- Supabase environment variables.
- Mailgun environment variables.
- Production Google OAuth configuration.
- Production Supabase redirect URLs.
- Successful end-to-end testing on the deployed website.

---

## 13. Out of Scope

The following are not required for the current version:

- Real inventory fulfilment.
- Real shipping operations.
- Admin dashboard.
- Customer account management beyond order history.
- Live card or bank payments.
- Team Zedu functionality.

---

## 14. Success Criteria

FolioVale is considered complete when a user can:

1. Visit the deployed shop.
2. Browse the collection.
3. Add one or more products to the bag.
4. Modify or remove bag items.
5. Sign in with Google.
6. Complete checkout.
7. Have the order stored in Supabase.
8. Receive a Mailgun confirmation email.
9. View the saved order in order history.
10. Sign out and later sign back in and still see the previous order.

---

## 15. Task 3 Phase 1: shared account backend

Preserve the existing web shop and API paths while preparing for a later Expo mobile app. The same verified Supabase account must resolve one account cart from both cookie-authenticated web and bearer-authenticated mobile requests. Guest cookies continue working; sign-in merges guest items with account items up to stock and the per-product limit of 10. Out-of-stock or inactive items are excluded during a merge.

Cart tokens stay private. Owners may read only their own cart metadata/items, and only the server may mutate them. Invalid bearer credentials return 401; browser mutations retain origin checks. Checkout and order ownership semantics remain intact.

The new migration prepares cart metadata for Realtime notifications and touches updated_at for item removal and checkout. Client subscriptions and mobile UI are out of scope for this phase. Changes remain local until the migration and a separate deployment are authorized.

Website account improvements in this release: general sign-in returns home, the shared header exposes Sign out, and customers can confirm deletion from their own visible order history while the original transaction record remains intact.
