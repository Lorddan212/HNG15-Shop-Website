# FolioVale content and Android preview preparation

> Historical development record — current project status is documented in [README.md](../../README.md).
> This records an earlier checkpoint, not current release instructions. Migration history is now aligned and the 21 catalogue corrections are live. See the [current compliance checklist](../implementation/HNG15_LESSON3_COMPLIANCE.md) for device and release status.

Date: 6 October 2026. The working tree was clean before this pass. This is a source/content and asset review, not an APK build or deployment.

## Customer-facing files reviewed

### Website

- `app/layout.tsx`, `app/page.tsx`: metadata, global layout and storefront entry point.
- `app/checkout/page.tsx`, `app/orders/page.tsx`, `app/orders/[id]/page.tsx`, `app/products/[slug]/page.tsx`: customer route titles and component wiring.
- `app/shipping/page.tsx`, `app/error.tsx`, `app/not-found.tsx`: shop policies, availability and page errors.
- `components/chrome.tsx`: header, footer, connection notices, cart and accessible labels.
- `components/luxury-storefront.tsx`, `components/storefront.tsx`, `components/book-art.tsx`: collection/category copy, product details, descriptions, empty states and illustrations.
- `components/checkout.tsx`, `components/orders.tsx`, `components/shop-provider.tsx`: checkout, payment, orders, confirmation, sign-in and cart notices.
- `lib/catalog.ts`: all 53 product names, descriptions and their defined specifications. Twenty-one local descriptions have grammar/capitalization corrections; names, categories, prices, inventory and specifications remain unchanged.
- `lib/email.ts`: plain-text and HTML order confirmation content. Delivery and provider logic are unchanged.
- `public/favicon.svg`, `public/images/hero-editorial.png`: canonical mark and editorial image/alt-text correspondence.
- Existing styles were checked for generated text; no layout or styling redesign was made.

### Mobile

- `mobile/src/app/_layout.tsx`, `mobile/src/app/(tabs)/_layout.tsx`: navigation labels and routes.
- `mobile/src/app/(tabs)/index.tsx`, `cart.tsx`, `account.tsx`: catalogue, product descriptions/subtitles, stock wording, guest/account cart, account and sign-in states.
- `mobile/src/app/checkout.tsx`, `mobile/src/app/auth/callback.tsx`: form, payment, retry, order confirmation and sign-in completion copy.
- `mobile/src/components/ui.tsx`, `mobile/src/components/product-cover.tsx`: shared labels, errors and cover artwork.
- `mobile/src/providers/shop-provider.tsx`, `mobile/src/lib/api-client.ts`, `guest-cart.ts`, `checkout-flow.ts`, `google-auth.ts`, `google-auth-flow.ts`, `config.ts`: customer-visible error messages and supporting behavior.
- `mobile/src/lib/cart-realtime.ts`: reviewed only to confirm that current cart-sync wording is supported. No Realtime edits.
- `mobile/app.json`, `mobile/eas.json`, and existing launcher/adaptive/favicon assets: startup branding and build-profile settings.

## Findings and changes

The audit found setup/testing terminology, obsolete claims that Google sign-in was still being configured, inconsistent cart/delivery terminology, unnecessarily technical sign-in/retry messages, unsupported material detail in hero alt text, and minor product-description grammar. The changes preserve current behavior and factual limitations.

| Before | After / reason |
| --- | --- |
| Bag / Add to bag / Shipping | Cart / Add to cart / Delivery, consistent across both clients. Internal names and API contracts remain intact. |
| Google sign-in and order history are being configured | Describes existing Google sign-in, shared carts, checkout authentication and website order history. |
| Checkout is currently in testing | Pay on delivery. No online payment is collected at checkout. No dispatch or delivery guarantee is added. |
| Shop setup is complete / development build / Expo Go | Customer-facing connection or installed-app guidance; authentication checks are unchanged. |
| A A5 notebook / one a6 field notes notebook | An A5 notebook / one A6 Field Notes notebook in the local catalogue source. Rendering uses unmodified description values. An unapplied timestamped data migration covers the database records. |
| Curated order | Collection order. The existing sort is by product ID, not editorial ranking or popularity. |
| Clothbound notebooks with fine brass details | Blue and cream notebooks arranged on a desk. Alt text avoids treating an editorial illustration as material evidence. |
| Confirmation email will go to this address | This is the email address associated with your order. Avoids guaranteeing email delivery. |
| Card and Bank Payment Coming Soon | Online payment: Not available yet. The existing option remains disabled. |

Copy changed in:

- `app/shipping/page.tsx`
- `components/chrome.tsx`, `components/luxury-storefront.tsx`, `components/storefront.tsx`
- `components/checkout.tsx`, `components/orders.tsx`, `components/shop-provider.tsx`
- `lib/email.ts`, `lib/catalog.ts`
- `mobile/src/app/(tabs)/index.tsx`, `cart.tsx`, `account.tsx`
- `mobile/src/app/checkout.tsx`
- `mobile/src/lib/google-auth.ts`, `google-auth-flow.ts`, `checkout-flow.ts` (message text only). `config.ts` was restored to its original actionable developer diagnostics.

One existing auth test expectation was adjusted for the new wording. No new runtime dependencies or business rules were introduced.

## Deliberately preserved / limitations

- Product names and the defined sizes, page counts, paper weights and set contents are existing catalogue data, not new claims. They were retained. Physical stock and supplier specifications have not been independently verified; this pass does not establish fulfillment readiness.
- Product illustrations remain illustrations, with the existing product-page label retained. No new real-product photography claim was added.
- Delivery fees and thresholds remain the existing application rules. No delivery time, coverage guarantee, office address, phone contact, review, rating, discount or business-history claim was invented.
- Current customer copy explains pay on delivery and that checkout collects no online payment. It makes no dispatch or delivery guarantee. Changing copy does not establish operational fulfillment readiness.
- Email states retain their actual meaning. Provider acceptance is not claimed as inbox delivery. The current Mailgun sandbox limitation is expressed on the shop-information page as email not being available for every address; saved orders remain accessible on the website.
- Online payment stays visibly unavailable. Pay on delivery is the only configured payment method. No order is described as paid.
- Backend contract/error strings and internal identifiers such as `bag`, `demo-note`, `previewProducts`, and provider imports were not renamed merely to pass a text search. They are not normal customer-facing marketing content. Technical documentation keeps implementation details.
- The website fallback catalogue has 21 description corrections. API/data flows remain unchanged. The API and mobile catalogue still read Supabase: `supabase/migrations/202610060001_catalog_description_corrections.sql` is prepared but NOT applied, so live descriptions remain unchanged. It updates description only when product UUID, slug and previous text match; retries skip corrected rows. Earlier migrations, Supabase settings and cloud environment variables remain unchanged.

## Icon assets

The generator `mobile/scripts/generate-brand-assets.cjs` reads the exact SVG path and its stroke attributes from `public/favicon.svg`; only uniform scale and translation are applied. It uses the already-installed website `sharp` dependency. Run it from the repository root with `node mobile/scripts/generate-brand-assets.cjs`.

| Asset in `mobile/assets/images/` | Result |
| --- | --- |
| `icon.png` | 1024×1024 opaque square, navy `#173452`, centered light `#F6F7F8` book, no text or rounded transparent corners. Also used by the existing splash configuration. |
| `android-icon-foreground.png` | 1024×1024 transparent PNG with only the original single-colour book mark. |
| `android-icon-background.png` | 1024×1024 opaque, uniformly `#173452`. |
| `android-icon-monochrome.png` | Same transparent single-colour shape as the foreground. No background rectangle, shadow, gradient or text; Android can tint its alpha mask. |
| `favicon.png` | 64×64 conversion of the canonical web favicon for the optional mobile web preview, replacing the Expo placeholder. |

Every painted adaptive-icon pixel is within radius 280.11 px of the image centre, inside Android's 66/108 safe-circle radius of 312.89 px at this resolution. Circle, rounded-square and squircle composites were visually inspected. Results are in ignored `output/branding-audit/folio-icons.png` and `icon-verification.json`.

`mobile/app.json` keeps name `FolioVale`, slug/scheme `foliovale`, package `com.lorddan212.foliovale`, splash background `#f8f6f0`, image width 180 and contain sizing. The adaptive background is now navy. The iOS override points to the same branded PNG instead of the old Expo Icon Composer artwork; no iOS native files were edited.

## Preview profile

`mobile/eas.json` preserves all development-profile settings. The new preview profile is independent (no inheritance), uses internal distribution, environment `preview`, and Android `buildType: apk`. It does not enable `developmentClient`. This config selects a standalone-style release preview, not a Metro-connected development client.

No EAS build was run. No preview cloud environment values were read or changed. Before a later authorized build, the preview environment must provide the existing public API/Supabase configuration; no keys are included in this report. Standalone launch, splash, launcher/themed masks and absence of DevTools still require installation of the eventual APK.

## Earlier review verification (before this checkpoint)

- Mobile `npx tsc --noEmit`: passed.
- Mobile `npm run lint`: passed.
- Mobile `npm test`: 84/84 passed, including existing Google auth, cart, checkout and Realtime tests.
- Mobile `npx expo-doctor`: 21/21 checks passed.
- Root `npm run typecheck`: passed.
- Root `npm test`: 39/39 passed.
- Root `npm run build`: passed. Its generated `next-env.d.ts` path changes were reverted to the initial state.
- Resolved Expo public configuration was inspected through a whitelist of branding fields; no publishable key was printed.
- Icon dimensions, opacity/transparency, exact background colour, foreground/monochrome agreement, and adaptive safe area passed.
- Development-profile equality and unchanged canonical SVG were checked against the initial commit.
- Auth/checkout/config/provider source structure was compared with the initial commit after normalizing message literals: no behavior changes in those files.
- `git diff --check`: passed.

The website/mobile screen audit was source-based. Launcher composites were visually inspected; no physical-device APK, live order, email delivery or new deployment verification was performed. No commit, push, deployment or cloud environment change was made.

## Follow-up review before checkpoint

Inspected the actual working files: `save an order`, `mobile app to access`, and `delivery details are used` already have correct spaces. The hero has `<div className="hero-colophon">`; `<divclassName>` was not present. No replacement characters, invalid UTF-8, or suspicious control characters were found in modified customer-facing files. Customer text was also extracted from TSX for a full wording review.

The delivery banner, product detail, collection benefit and checkout note now say: **Delivery fee calculated at checkout · Free from ₦30,000**. Shop information describes ₦1,500 below ₦30,000 and no delivery fee from ₦30,000. Calculations are unchanged.

Checkout, confirmations, shop information, and both receipt formats now explain: **Pay on delivery. No online payment is collected at checkout.** The mobile address form heading is now “Delivery details”.

Accepted email wording on web and mobile now reads: **Your confirmation email was accepted for delivery. Check your inbox or spam folder. Your order is also saved in your account.** Pending/processing states and email retry eligibility are unchanged. The existing receipt test expectation now checks “Pay on delivery. No online payment is collected at checkout.”

`mobile/src/lib/config.ts` runs at module initialization before the application UI. Its original missing-variable and invalid-URL errors are restored verbatim: they name the configuration variable and required format, never its value. “Install the latest app” was not actionable for these configuration failures. Auth behavior remains unchanged.

Runtime grammar-repair regexes were removed from both renderers. `lib/catalog.ts` now corrects the descriptions for:

- The Aster
- The Nocturne
- The Harbour
- The Atlas
- Field Notes
- The Studio
- The Letters
- The Mosaic
- The Coastline
- The Stillwater
- The Linen
- The Graphite
- The Meadow
- The Moonlit
- The Everyday
- The Folio
- The Writing Pair
- The Planner Pair
- The Studio Set
- The Daily Ritual
- The Workday Edit

Sixteen notebook descriptions change “A A4/A5/A6” to “An A4/A5/A6”; five set descriptions correct size and referenced-product capitalization. No subtitles required a correction. Product identity, prices, stock, categories, slugs and specifications are unchanged. `supabase/migrations/202610060001_catalog_description_corrections.sql` contains the matching exact-ID/slug/old-text updates for later authorized application. This is a data-only migration and has not been executed.

The requested term scan found only technical documentation/test helpers, internal CSS classes (`demo-note`, `setup-notice`), and “assignment dates” in The Study Plan's appropriate product-use description. These were deliberately preserved. The existing encoding issue in the developer-only AGENTS heading was outside customer-facing scope and left unchanged. The approved icon assets, canonical SVG and app/EAS configurations match the review-start hashes exactly.

Verification was rerun after the corrections. The first root typecheck picked up temporary review backups with `.tsx` extensions inside ignored output; those backups were renamed to `.txt`, without changing project configuration, and the rerun passed. Physical-device, browser layout, live catalogue and email inbox verification are not claimed.

## Final pre-build checkpoint — 6 October 2026

- Current customer wording: **Pay on delivery. No online payment is collected at checkout.** Applied in website checkout, order details, shop information, plain-text/HTML receipts and mobile checkout/confirmation. Removed the obsolete dispatch-unavailable sentence from shop information. Online payment remains disabled. No checkout, authentication, cart, payment, email-provider or synchronization logic changed.
- Converted the loose catalogue correction into `supabase/migrations/202610060001_catalog_description_corrections.sql`, using the repository's existing `YYYYMMDDNNNN_description.sql` convention. Its transaction contains one qualified UPDATE, with exactly 21 UUID/slug/old-description matches, and assigns only `description`. Existing catalogue names, IDs, slugs, prices, stock, active state, categories and specifications are untouched. Already-corrected or independently edited descriptions are skipped. Static checks confirm every old/new description matches its intended source record. The migration was NOT applied, including to a disposable database.
- Removed the superseded loose SQL file and all 24 temporary artifacts under `output/content-review`, including the backup directory. No tsconfig change was made. The branding generator and this audit are retained.

### Read-only migration-history inspection

The live FolioVale project's migration history was read through the Supabase connector. It contains these four entries, whose versions differ from the equivalent local filenames:

| Local file | Remote recorded version/name |
| --- | --- |
| `202610010001_shop.sql` | `20261001113845_foliovale_shop_schema` |
| `202610010002_catalog.sql` | `20261001122703_foliovale_catalog` |
| `202610010003_expanded_catalog.sql` | `20261001163535_expand_foliovale_catalog_53_products` |
| `202610050001_order_history_deletion.sql` | `20261005100819_order_history_deletion` |
| `202610050002_shared_account_carts.sql` | No recorded migration; read-only checks confirm `public.carts.user_id` and `public.resolve_account_cart` exist. This does not prove every statement is applied. |
| `202610060001_catalog_description_corrections.sql` | New and unapplied. |

There is no local `supabase/config.toml` or linked-project metadata in this checkout. A plain database push is therefore not a catalogue-only release path: local/remote version history must be reconciled first. All five earlier local versions are absent as exact versions from remote history, while four remote versions are absent locally. Do not replay those files to resolve the discrepancy; the shared-cart migration includes non-idempotent DDL for objects already present. This review made no history repairs, database writes, CLI linking, pushes or configuration changes. See the Supabase migration guide: https://supabase.com/docs/guides/deployment/database-migrations.

### Verification at this checkpoint

- Mobile TypeScript: passed.
- Mobile lint: passed.
- Mobile tests: 84/84 passed.
- Expo Doctor: **20/21 passed; dependency version check failed**. No dependencies were changed or exclusions added.
- Root typecheck: passed with no temporary source backups and no tsconfig changes.
- Root tests: 39/39 passed.
- Root production build: passed. Its generated next-env.d.ts changes were restored to the exact checkpoint-start bytes.
- `git diff --check`: passed (only Git line-ending notices).
- Migration static validation: exactly 21 unique stable IDs/slugs, old/new strings aligned with the catalogue, only description assigned, transaction and exact-match guards present. No migration executed.
- Protected asset/config checks: canonical mark, PNGs, branding generator, app.json, eas.json, and both tsconfig files unchanged from checkpoint start.

Expo Doctor reported these installed → expected patch versions:

| Package | Installed | Expected |
| --- | --- | --- |
| `@expo/ui` | 57.0.21 | ~57.0.22 |
| `expo` | 57.0.26 | ~57.0.27 |
| `expo-auth-session` | 57.0.13 | ~57.0.14 |
| `expo-constants` | 57.0.20 | ~57.0.21 |
| `expo-linking` | 57.0.11 | ~57.0.12 |
| `expo-router` | 57.0.24 | ~57.0.25 |

These dependency findings and the migration-history mismatch remain outstanding. Neither was hidden or automatically repaired during this scoped review.


## Technical cleanup follow-up

See [MIGRATION_RECONCILIATION.md](MIGRATION_RECONCILIATION.md) for the full read-only history/source comparison, per-object shared-cart verification, catalogue safety review and proposed later commands. The first three stored migrations match after line-ending normalization; the fourth differs only by a trailing newline. All shared-cart function bodies match after CRLF normalization, and the required index, permissions, trigger and publication are present. Correction: all five customer policies explicitly target authenticated in both committed local SQL and the live database. No policy-role/state-capture migration is needed or created. The filename-only checkpoint renames five migrations without changing SQL bytes; no history repair or migration application is performed.

Expo SDK 57 patch alignment completed on 7 October 2026. The final alignment command reports dependencies up to date; Expo Doctor passes 21/21. Mobile TypeScript/lint and 84 tests, root typecheck and 39 tests, the website production build, and git diff --check all pass. Exact manifest/lock changes and the unexecuted migration plan are recorded in the technical report. The preceding 20/21 Doctor result describes the earlier checkpoint and is resolved; migration history remains unchanged.
