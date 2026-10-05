# FolioVale Task 3 — Phase 1 handoff

Phase 1 prepares the existing Next.js backend for a later mobile app. No mobile UI or realtime client has been built in this phase. No commit, push or website deployment has been performed.

## Website account changes

- General Google sign-in returns home. Checkout and order-history sign-in retain their explicit destinations.
- OAuth now uses the exact registered `/auth/callback` URL. A 10-minute, same-site cookie stores only the allowlisted destination and is cleared after the callback. This avoids Supabase falling back to the Site URL when callback query parameters do not match the allowlist.
- The shared header shows **Sign out** for authenticated customers.
- Order history includes **Delete from history**, with a confirmation dialog, pending/error states and verified ownership. The saved order is soft-deleted, preserving stock, snapshots and checkout request IDs. It is not an order cancellation.
- The order-history migration was already applied to FolioVale Supabase during the preceding website work. No existing customer order was removed by this work.

## Files changed

| Area | Files |
| --- | --- |
| API contract and identity | `lib/request-auth.ts`, `lib/cart-identity.ts`, `lib/handlers.ts`, `lib/api.ts`, `lib/repository.ts`, `lib/supabase/server.ts`, `proxy.ts` |
| Order route | `app/api/orders/[id]/route.ts` |
| Sign-in return | `app/auth/callback/route.ts`, `lib/auth-callback.ts`, `components/shop-provider.tsx` |
| Website account controls | `components/chrome.tsx`, `components/orders.tsx`, `app/luxury.css` |
| Database | `supabase/migrations/202610050001_order_history_deletion.sql`, `supabase/migrations/202610050002_shared_account_carts.sql` |
| Tests | `tests/auth.test.ts`, `tests/shop.test.ts`, `tests/request-auth.test.ts`, `tests/cart-identity.test.ts`, `tests/database.sql`, `tests/shared-carts.sql`, `tests/database-runner.mjs` |
| Documentation | `AGENTS.md`, `README.md`, `PRD.md`, `TASK3_PHASE1.md` |

Existing API paths and their JSON representations remain in place. The existing untracked `mobile/` folder was not modified. Original applied schema/catalogue migration files were not edited. No application dependency was added.

## Exact database changes

New pending migration: **`202610050002_shared_account_carts.sql`**.

1. Adds nullable `public.carts.user_id`, referencing `auth.users(id) ON DELETE CASCADE`. Existing carts retain `user_id = NULL`.
2. Adds the partial unique index `carts_user_id_unique`, allowing one cart per non-null user ID and multiple guest carts. Existing token-hash uniqueness and item indexes remain.
3. Keeps RLS enabled. Adds owner-only SELECT policies for carts and cart items. Authenticated clients may select only `id`, `user_id`, `created_at` and `updated_at` from carts; `token_hash` stays private. Neither anonymous nor authenticated clients receive direct write privileges.
4. Adds `resolve_account_cart(uuid,text,text)`, callable only by the service role. It serializes per-user resolution and guest mutations, creates a separate random account token, locks cart/product rows, merges quantities up to stock and 10, removes unavailable items, and deletes only the successfully merged obsolete guest cart. Existing account items are preserved subject to availability and quantity caps. Repeated resolution does not duplicate a merge.
5. Adds `touch_cart_from_items()` and the `cart_items_touch_parent` trigger. Inserts, updates, removals and checkout clearing change the parent cart timestamp for future subscribers.
6. Replaces `change_cart` and `checkout_cart` in this NEW migration, preserving their existing signatures. Adds token-based transaction locks and prevents checkout of a cart owned by a different account. Pricing, order snapshots, stock locking, idempotency, rate limits and email behavior remain intact.
7. Adds carts to `supabase_realtime` if absent, publishing only non-secret metadata. No client subscription is added. Later clients should subscribe to their own cart changes and refetch `/api/cart`; `SELECT *` on carts is intentionally prohibited.

The earlier `202610050001_order_history_deletion.sql` adds `orders.deleted_at` and hides deleted orders from authenticated reads. It has already been applied to FolioVale; do not rerun it there.

## Authentication and API behavior

- Cookie sessions continue using Supabase `getUser()`.
- A supplied `Authorization: Bearer <access token>` takes precedence and is validated with Supabase `getUser(token)` using a sessionless client. Identity is never derived from an unverified token or a client-supplied user ID.
- Invalid, expired or malformed credentials return 401, even if valid browser cookies are present. Bearer requests do not read or merge browser guest cookies.
- Only successfully verified bearer requests may omit Origin on mutations. Cookie/guest requests retain the matching-origin guard. Invalid headers do not bypass it.
- `/api/session` returns the same Customer representation for both authentication methods. Cart, checkout, order listing/detail, deletion and email retries use the verified identity.
- Guests retain their HttpOnly `fv_bag` cookie and server-side SHA-256 hash. On the first authenticated cart read/write/checkout, that guest cart is merged automatically. Both web and mobile then resolve the same account cart.
- Refetch/refresh is required to observe changes on an already-open second device in this phase. Realtime subscriptions come later. No permissive CORS or `/api/mobile/*` routes were introduced; native mobile requests do not need browser CORS.

References: [Supabase token validation](https://supabase.com/docs/reference/javascript/auth-getuser), [column-level security](https://supabase.com/docs/guides/database/postgres/column-level-security), [Postgres change subscriptions](https://supabase.com/docs/guides/realtime/postgres-changes).

## Verification

- `npm run typecheck`: passed.
- `npm test`: 39 tests passed, zero failed, including existing Task 2 cases.
- `npm run build`: production build passed.
- `node tests/database-runner.mjs`: both transaction scripts passed against a disposable PGlite PostgreSQL database after applying all five migrations. Tests cover guest compatibility, shared account identity, merging, caps, repeated merges, owner isolation, column privileges, direct-write denial, timestamps, publication metadata, checkout and order deletion. Test fixtures were rolled back; no Task 3 schema change was made to live Supabase.
- Local production-server HTTP checks passed: invalid bearer GETs for session/cart/products/orders returned 401; invalid bearer POST without Origin returned 401; anonymous cart GET returned 200; guest POST without Origin returned 403. These invalid-token checks reached the actual Supabase validation path; no customer records were changed. Valid bearer identity is covered by automated tests, not a completed mobile sign-in flow.
- PGlite does not verify simultaneous database connections or a live Supabase Realtime stream. Browser control timed out during final review, so final visual and full Google round-trip verification remain unconfirmed. Earlier browser checks identified the callback query mismatch that was corrected.

The database test tool is installed only in ignored `output/db-check`, not in the application dependency tree. Reproduction commands are in README.

## Migration and release instructions

The Task 3 migration is **prepared, not applied**.

1. Open the **FolioVale Shop** project (`qolxxboicrhhrunfljbj`) in Supabase SQL Editor.
2. Open `supabase/migrations/202610050002_shared_account_carts.sql` locally. Run its complete contents as a single SQL batch, wrapped in `BEGIN;` and `COMMIT;`. Do not paste secrets or rerun the original schema migrations.
3. Confirm `carts.user_id`, `carts_user_id_unique`, `resolve_account_cart` and the cart publication entry exist. Review the owner-only policies and column grants.
4. Only then deploy the matching backend when ready. No new environment variables or API keys are required.
5. Verify Google sign-in lands home, sign-out is visible, order-history removal works, and a guest bag survives sign-in. Use the same Supabase account from a second client to verify the shared bag and bearer checkout. Test Mailgun only with an authorized sandbox recipient.

For a brand-new database, apply all migrations in filename order instead. The disposable database runner is not a production migration command. CLI migration history should be reconciled before any broad `supabase db push`, because earlier migrations were applied through the connected Supabase tooling.

## Risks to the currently deployed Task 2 website

- The deployed website code was not changed. The shared-cart migration was not applied.
- New local authenticated-cart calls return 503 until the new migration exists. Deploying code before SQL would cause the same failure in production.
- The migration preserves old RPC signatures and all existing carts/orders/products. The old website continues resolving guest-cookie carts until the new backend is deployed. Avoid a long interval between migration and code rollout, or mixing old and new instances while testing account carts.
- Once customers use shared carts, reverting to the old backend makes it read guest bags instead of account bags. Account data remains saved, but a rollback needs a plan.
- The preceding order-history migration is already live; deletion controls and filtering still require the updated website code. No existing customer order was deleted during testing.
- Realtime channel behavior and actual multi-device end-to-end flows must be checked after migration and before mobile release. Mailgun sandbox restrictions remain unchanged.
