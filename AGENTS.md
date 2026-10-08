# FolioVale — Agent Guidelines

## Purpose

Build and maintain the existing FolioVale notebook and planner shop. Maintain the website and Expo mobile storefront, shared account carts, checkout, Supabase persistence and Google authentication. Mailgun remains website backend functionality inherited from Lesson 2.

## Architecture

- Next.js App Router, React, TypeScript, and plain CSS.
- Read relevant installed Next.js documentation in `node_modules/next/dist/docs/` before changing framework-specific code.
- `app/`: pages and HTTP route handlers.
- `components/`: storefront, cart, checkout, orders, shared UI, and shop state.
- `lib/`: validation, prices, server repository, auth, email, types, and testable handlers.
- `supabase/migrations/`: versioned database schema and catalogue seed.
- `tests/`: focused API and business-rule tests.
- `mobile/`: Expo SDK 57 React Native client with TypeScript and Expo Router; read `mobile/AGENTS.md` before editing it. Keep it excluded from root TypeScript compilation.
- `README.md`: setup, verification, and deployment status.
- `.env.local`: private configuration, ignored by Git.

## Scope and design

The FolioVale catalogue contains 53 products: 25 notebooks, 18 planners, and 10 sets. Checkout records pay-on-delivery orders. Do not add real payments, unrelated dashboards, or unrequested dependencies.
Preserve the ink-blue, pale-blue, paper-white design, serif headings, original notebook illustrations, and responsive layouts. Keep customer-facing copy clear. Do not invent testimonials, sales counts, certifications, shipping guarantees, or real-world brand claims.
Use FolioVale branding without internship or HNG references in customer-facing copy. The owner currently wants professional pre-launch branding. Use concise payment wording at checkout, in order details, and in receipts: Pay on delivery. No online payment is collected at checkout. Do not claim delivery or dispatch has occurred or is guaranteed. Do not describe the customer experience as testing, a demo, an assignment, or provider setup. No real inventory fulfillment has been arranged.

## Data and security

- Use Supabase for products, carts, profiles, orders, order items, and email status.
- Never replace database persistence with localStorage or fake successful orders.
- Keep Supabase secret keys and Mailgun API keys server-only. Never print, commit, or prefix them with NEXT_PUBLIC.
- Validate user identity through Supabase `getUser()` for protected actions. API routes support both cookie sessions and explicit Bearer tokens. A supplied Authorization header takes precedence; invalid tokens return 401 and must never fall back to cookies.
- Website guests own carts through a random HttpOnly cookie; store only its SHA-256 hash in the database.
- Every order lookup must restrict results to the verified user ID.
- Keep RLS enabled. Browser roles may read active products and their own orders/profile. The shared-account-cart migration allows authenticated users to read only their own cart metadata/items; token_hash stays server-only. All writes remain server-only.
- Resolve authenticated carts by verified user ID through the service-role-only resolve_account_cart function. Never promote a guest cookie hash to an account-cart token. Merge under database locks and preserve quantity/stock caps.
- Only a successfully verified Bearer request may omit Origin on mutations. Cookie and guest requests retain the same-origin check. Never infer authorization from a header merely being present.
- Mobile uses the same Supabase project, S256 PKCE Google OAuth, foliovale://auth/callback and persisted native sessions. AsyncStorage guest carts use journaled account merges; authenticated checkout uses the existing API. Realtime owner-filtered cart notifications trigger API refetch, with foreground recovery. Preserve local-only sign-out, checkout request UUID reuse, guest merge retry safety and the website callback. Never trust callback identity fields or create /api/mobile routes or fake sessions.
- Calculate totals and stock adjustments in the checkout database transaction. Never accept client prices.
- Preserve checkout idempotency and stock locking. A repeated request ID must return the same order.
- Preserve order snapshots even if catalogue prices change.
- Email failures must never erase a saved order. Mailgun acceptance is not proof of inbox delivery.
- Keep email retries bounded and use the atomic claim function. Never automatically retry an ambiguous accepted/sending result.
- Do not read customer data unnecessarily or use personal customer records for tests.

## Workflow

Inspect current files and Git status before edits. Preserve unrelated user work.
Keep changes small and coherent. Update the README when behavior or setup changes.
Do not deploy, commit, push, or create extra external resources unless the user authorizes it.
Use the FolioVale Supabase project only; do not modify unrelated projects.
Provider setup proceeds one checkpoint at a time. Users enter secrets locally, outside chat.

## Verification

- Run `npm run typecheck`, `npm test`, and `npm run build` for relevant functional changes.
- For mobile changes, also run `npx expo-doctor`, `npx tsc --noEmit`, `npx expo lint`, and `npm test` from `mobile/`. Distinguish bundle checks from physical-device verification.
- Tests must cover every application endpoint: valid requests, invalid inputs, authentication, and ownership.
- Test checkout idempotency, server totals, stock, cart clearing, and email claims against an isolated database transaction with rollback.
- Review desktop and mobile layouts, keyboard navigation, dialog dismissal, long text, and empty/error states.
- Verify live Google sign-in and Mailgun delivery only after configuration. Do not report mocked tests or provider API acceptance as end-to-end delivery verification.
- Keep generated verification output in ignored `output/` or outside the project. Do not leave source backups inside TypeScript compilation paths.
- Read `docs/implementation/HNG15_LESSON3_COMPLIANCE.md` for current acceptance evidence; archived phase reports are not current instructions.
