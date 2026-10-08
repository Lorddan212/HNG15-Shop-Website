# FolioVale migration reconciliation review

> Historical development record — current project status is documented in [README.md](../../README.md).
> This records an earlier checkpoint, not current release instructions. Migration history is now aligned and the 21 catalogue corrections are live. See the [current compliance checklist](../implementation/HNG15_LESSON3_COMPLIANCE.md) for device and release status.

Read-only inspection: 6 October 2026. Project: `qolxxboicrhhrunfljbj`.

**The local filename reconciliation is authorized; remote history remains unchanged.** No migration was applied, no history row repaired, no database push/dry-run run, and no catalogue SQL executed. The five filename changes below preserve the SQL bytes. Only metadata, function definitions, migration-history statements and the public product catalogue were read; no customer records were inspected.

## Recorded history versus local source

| Local migration | Recorded remote version | Comparison of stored SQL |
| --- | --- | --- |
| `20261001113845_foliovale_shop_schema.sql` | `20261001113845_foliovale_shop_schema` | Previously verified mapping; this checkpoint preserves the local SQL bytes. |
| `20261001122703_foliovale_catalog.sql` | `20261001122703_foliovale_catalog` | Previously verified mapping; this checkpoint preserves the local SQL bytes. |
| `20261001163535_expand_foliovale_catalog_53_products.sql` | `20261001163535_expand_foliovale_catalog_53_products` | Previously verified mapping; this checkpoint preserves the local SQL bytes. |
| `20261005100819_order_history_deletion.sql` | `20261005100819_order_history_deletion` | Same SQL; local file has one extra trailing newline (349 versus 348 characters). |
| `20261005110000_shared_account_carts.sql` | No recorded row | All implemented objects/logic confirmed; local and remote policy roles both target authenticated. |
| `202610060001_catalog_description_corrections.sql` | No recorded row | Genuinely unapplied. All 21 old-description guards match the current public catalogue. |

Each of the four remote records contains its full SQL as one stored statement. The comparison used that SQL, not dates or names. The original schema's six tables, columns, constraints, indexes, RLS and grants were inspected. Current `change_cart` and `checkout_cart` definitions correspond to the later shared-cart migration, not their superseded initial bodies. `claim_order_email` still matches its initial definition.

The remote catalogue contains 53 products: 25 notebooks, 18 planners and 10 sets. All original catalogue fields match the source seed data except current stock in six products (one lower each). Those live inventory values must not be reset. The 21 description corrections are not yet present.

`orders.deleted_at` is nullable timestamptz; the orders SELECT policy checks ownership and `deleted_at IS NULL`. The order-items policy checks its parent through the orders RLS policy. These implement the deletion migration without deleting persisted order snapshots.

## Complete shared-cart statement/object verification

| Local statement/object | Status and remote evidence |
| --- | --- |
| Add `carts.user_id` | **Confirmed present**: nullable UUID, validated FK to `auth.users(id)`, `ON DELETE CASCADE`. |
| `carts_user_id_unique` | **Confirmed present**: valid/ready unique btree on `user_id` with predicate `user_id IS NOT NULL`; one account cart per non-null owner, multiple guest rows allowed. |
| Revoke client cart-table privileges | **Confirmed present**: anon has no cart/cart-item read or write grants; authenticated has no whole-cart SELECT or writes. |
| Grant safe cart-column SELECT | **Confirmed present**: authenticated may read only `id`, `user_id`, `created_at`, `updated_at`; `token_hash` cannot be selected. |
| Grant cart-item SELECT | **Confirmed present**: authenticated can SELECT cart items; INSERT/UPDATE/DELETE/TRUNCATE are denied. |
| `Read own account cart` policy | **Confirmed present**: SELECT checks `user_id = auth.uid()`; both committed local SQL and live policy explicitly target authenticated. |
| `Read own account cart items` policy | **Confirmed present**: SELECT checks parent-cart ownership; both committed local SQL and live policy explicitly target authenticated. |
| Cart/cart-item RLS | **Confirmed present** and enabled; anon/authenticated are not superusers and do not bypass RLS. Service role has the intended bypass and table privileges. |
| `touch_cart_from_items()` | **Confirmed present**: body matches after CRLF normalization; returns trigger; SECURITY DEFINER, empty search_path, postgres owner. Uses OLD cart ID for DELETE and NEW otherwise; sets clock_timestamp(). |
| Touch-function revokes/grant | **Confirmed present**: execute ACL contains postgres and service_role only, no PUBLIC/anon/authenticated. |
| `cart_items_touch_parent` | **Confirmed present**: enabled AFTER INSERT/UPDATE/DELETE, FOR EACH ROW, invokes the touch function. |
| `resolve_account_cart(uuid,text,text)` | **Confirmed present**: complete body matches after CRLF normalization; returns text, SECURITY DEFINER, empty search_path. |
| Resolver identity/ownership | **Confirmed present in matched body**: existing user validation, token-format validation, account/user and guest-token advisory locks, account row lock, guest must have null owner, no guest-token promotion. |
| Resolver merge rules | **Confirmed present in matched body**: stable product-ID stock locks; sum capped at 10/current stock; inactive removal; preserves account cart; deletes only unowned guest cart; touches account metadata. |
| Resolver revokes/grant | **Confirmed present**: service_role-only application execution; anon/authenticated/PUBLIC excluded. |
| Publication existence branch | **Confirmed present state**: `supabase_realtime` exists, not an all-tables publication, and publishes UPDATE (also INSERT/DELETE/TRUNCATE). The historical branch execution itself is not recoverable. |
| Publication cart registration branch | **Confirmed present state**: only `id`, `created_at`, `updated_at`, `user_id` are published for carts; no token_hash or row filter. Column ordering is catalogue ordering, with the same column set. |
| Replacement `change_cart(text,uuid,integer,text)` | **Confirmed present**: entire body matches after CRLF normalization, including token advisory lock, existing signature/void result, quantity/stock checks and row locking. |
| change_cart security/revokes/grant | **Confirmed present**: SECURITY DEFINER, empty search_path, postgres owner, execute restricted to postgres/service_role. |
| Replacement `checkout_cart(text,uuid,text,uuid,jsonb)` | **Confirmed present**: entire body matches after CRLF normalization, including account-cart owner restriction, token lock, idempotency, verified user/email, delivery validation, stock locks, server totals, snapshots, profile update and cart clearing. |
| checkout_cart security/revokes/grant | **Confirmed present**: original UUID return/signature; SECURITY DEFINER, empty search_path, postgres owner, execute restricted to postgres/service_role. |
| Shared-cart migration-history entry | **Confirmed absent**. |
| Live mutation/concurrency behavior tests | **Unable to verify in this read-only review**: no customer RPCs, orders, cart changes, DDL or test transactions were executed remotely. Function text and effective privileges were verified instead. |

No required shared-cart object was found missing. The five customer policies for profiles, orders, order_items, carts and cart_items explicitly target authenticated in both committed local SQL and the live database. There is no PUBLIC-to-authenticated policy drift requiring another migration.

One broad metadata result initially returned a null default for `order_items.id`. A targeted PostgreSQL catalogue check confirmed `atthasdef=true` and `gen_random_uuid()`; no missing UUID default is asserted and no repair is proposed for it.

## Corrected reconciliation status — 7 October 2026

The earlier PUBLIC-to-authenticated policy-drift finding was incorrect. Both the working files and committed local migrations explicitly target authenticated for all five customer policies; the live policies also target authenticated. No policy-role/state-capture migration is needed or permitted, and none exists. The previous proposal, ALTER POLICY SQL, and associated repair instructions have been withdrawn.

Only five filename changes are authorized in this checkpoint. All five SQL files are checked by SHA-256 and direct byte comparison before/after renaming. The shared-cart version is now 20261005110000, following order-history deletion at 20261005100819. The catalogue correction stays at 202610060001, unchanged and unapplied.

The four recorded remote versions remain unchanged. The shared-cart migration is already implemented remotely but unrecorded; the catalogue correction is genuinely unapplied. No migration repair or database push is authorized or performed. Do not rerun shared-cart DDL. Any future tracking repair must use the new shared-cart version and requires separate authorization.

The only requested database command at this checkpoint is:

```powershell
supabase migration list --linked
```

Expected version pairs from the previously inspected remote history after the local renames (not a substitute for actual CLI output):

```text
LOCAL           REMOTE
20261001113845  20261001113845
20261001122703  20261001122703
20261001163535  20261001163535
20261005100819  20261005100819
20261005110000  -
202610060001    -
```

No CLI installation, project linking, history repair, database push, migration application or EAS configuration change is part of this rename checkpoint.

## Catalogue migration safety

The file has one UPDATE in BEGIN/COMMIT. Its explicit VALUES list contains exactly 21 unique product UUIDs and matching stable slugs. All 21 current remote descriptions match the old-text predicates, so the current snapshot would update 21 rows. The new descriptions exactly match lib/catalog.ts. The only assigned field is description. No price, stock, name, slug, category, specifications, active state or ID is assigned; no rows are created or deleted. A concurrently/independently edited description fails the old-text guard and is preserved; consequently a later execution can correctly update fewer than 21 rows. Already-corrected rows are skipped on retry. No migration was executed to perform this validation.

## References

- https://supabase.com/docs/reference/cli/supabase-migration-repair
- https://supabase.com/docs/reference/cli/supabase-migration-list
- https://supabase.com/docs/reference/cli/supabase-db-push
- https://docs.expo.dev/more/expo-cli/#version-validation


## Expo SDK 57 patch alignment — 7 October 2026

`npx expo install --fix` was used. Its final rerun exited successfully with “Dependencies are up to date”. The initial installation inherited NODE_ENV=production and omitted development tools; those existing locked tools were restored with npm ci --include=dev. Windows then denied Expo's atomic package.json replacement twice. The generated manifest was checked to contain only the four remaining requested patch changes and saved directly, without hand-selecting versions. A stale cached registry response was resolved by checking the published versions and installing with fresh metadata. The duplicate temporary manifest was removed. No dependency checks were suppressed.

| Direct package | Installed before | Installed after | package.json |
| --- | --- | --- | --- |
| @expo/ui | 57.0.21 | 57.0.22 | ~57.0.22 |
| expo | 57.0.26 | 57.0.27 | ~57.0.27 |
| expo-auth-session | 57.0.13 | 57.0.14 | ~57.0.14 |
| expo-constants | 57.0.20 | 57.0.21 | ~57.0.20 unchanged; already allows 57.0.21, which is locked and installed |
| expo-linking | 57.0.11 | 57.0.12 | ~57.0.12 |
| expo-router | 57.0.24 | 57.0.25 | ~57.0.25 |

The manifest changes exactly five dependency ranges; devDependencies, scripts and the complete package-name set are unchanged. The lockfile changes 19 package versions (the six direct packages above and 13 Expo build/runtime dependencies), all patch-only. There are no added or removed package entries and no unrelated replacements. React stays 19.2.3 and React Native stays 0.86.3. Expo remains SDK 57. No auth/cart/checkout source, branding, app/EAS configuration or migration SQL was changed.

Exact lockfile version changes:

| Lockfile package path | Before | After |
| --- | --- | --- |
| `node_modules/@expo/config` | 57.0.9 | 57.0.10 |
| `node_modules/@expo/config-plugins` | 57.0.9 | 57.0.10 |
| `node_modules/@expo/image-utils` | 0.11.5 | 0.11.6 |
| `node_modules/@expo/metro-config` | 57.0.12 | 57.0.13 |
| `node_modules/@expo/metro-file-map` | 57.0.3 | 57.0.4 |
| `node_modules/@expo/prebuild-config` | 57.0.16 | 57.0.17 |
| `node_modules/@expo/require-utils` | 57.0.5 | 57.0.6 |
| `node_modules/@expo/ui` | 57.0.21 | 57.0.22 |
| `node_modules/babel-preset-expo` | 57.0.13 | 57.0.14 |
| `node_modules/expo` | 57.0.26 | 57.0.27 |
| `node_modules/expo-asset` | 57.0.18 | 57.0.19 |
| `node_modules/expo-auth-session` | 57.0.13 | 57.0.14 |
| `node_modules/expo-constants` | 57.0.20 | 57.0.21 |
| `node_modules/expo-linking` | 57.0.11 | 57.0.12 |
| `node_modules/expo-modules-autolinking` | 57.0.13 | 57.0.14 |
| `node_modules/expo-modules-core` | 57.0.20 | 57.0.21 |
| `node_modules/expo-router` | 57.0.24 | 57.0.25 |
| `node_modules/expo/node_modules/@expo/cli` | 57.0.27 | 57.0.28 |
| `node_modules/expo/node_modules/@expo/cli/node_modules/@expo/router-server` | 57.0.11 | 57.0.12 |


## Previous technical-cleanup verification — 7 October 2026

| Command | Result |
| --- | --- |
| Mobile npx expo install --fix | Passed; dependencies up to date |
| Mobile npx tsc --noEmit | Passed |
| Mobile npm run lint | Passed |
| Mobile npm test | 84/84 passed |
| Mobile npx expo-doctor | 21/21 passed |
| Root npm run typecheck | Passed |
| Root npm test | 39/39 passed |
| Root npm run build | Passed; website production build only |
| git diff --check | Passed |

For lock entries with unchanged versions, only the root dependency ranges changed; there are no unrelated metadata changes. Generated next-env.d.ts was restored to the exact review-start bytes. All protected application sources, existing SQL, branding assets, app/EAS configuration and tsconfig match their review-start hashes. Temporary Expo package.json replacement output was removed. No temporary review source files were added to compilation paths.

Files changed during this technical-cleanup pass: mobile/package.json, mobile/package-lock.json, README.md, CONTENT_AUDIT.md, and the new MIGRATION_RECONCILIATION.md. Earlier uncommitted branding/content changes are preserved. During that earlier technical-cleanup pass, no APK, commit, push, deployment, EAS environment change, database mutation, history repair, migration rename or migration application was performed. The later filename-only checkpoint is recorded above. Physical-device authentication/cart/checkout and APK validation remain separate future checks.

## Filename-only verification

- `202610010001_shop.sql` → `20261001113845_foliovale_shop_schema.sql`; 9897 bytes; SHA-256 `73bed96701cb08a044db4341b6e8f0dbacff1ca489a5574ef26ab4cadfc3b5ad`.
- `202610010002_catalog.sql` → `20261001122703_foliovale_catalog.sql`; 2401 bytes; SHA-256 `78d085524bdc1b844cd4123a56105b9dd122bd2d1cbf3e44becb22e61a0dc1bf`.
- `202610010003_expanded_catalog.sql` → `20261001163535_expand_foliovale_catalog_53_products.sql`; 20231 bytes; SHA-256 `3d944022f983e897850a5340f7dd6e6ac026db79e875613a4915573bbc38c8eb`.
- `202610050001_order_history_deletion.sql` → `20261005100819_order_history_deletion.sql`; 354 bytes; SHA-256 `54dc7f289fc3e9008b23c5548c9998ae67afe09ce88b795fbb473e0e8f16aa41`.
- `202610050002_shared_account_carts.sql` → `20261005110000_shared_account_carts.sql`; 10411 bytes; SHA-256 `7d164835e6539e649f11250615e5a2942f9033ef775e483c0a0623886e952f8b`.

Catalogue SHA-256 retained: `ba8ff011b8979b3db7ad936c6a881e83717506582e2883cc17addb2198c8e526`.
