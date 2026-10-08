# FolioVale cleanup checkpoint

Date: 7 October 2026. Scope: repository hygiene, documentation and read-only evidence checks. The EAS preview build was reported running when work began. No cloud build, deployment, database write, migration repair, Git commit/push or EAS variable change is part of this cleanup.

## Inventory and classification

Inventory used `git ls-files`, clean initial `git status --short`, hidden directory listings, ignored-file status and a source/generated artifact walk. Dependency trees were classified as installed tooling rather than reviewed file by file. Git warned about long paths inside ignored iOS framework dependencies; none were modified.

| Classification | Files/directories | Decision |
| --- | --- | --- |
| A — production/source | `app/`, `components/`, `lib/`, `proxy.ts`, `mobile/src/`, `public/` | Retain runtime code, error handling and catalogue; correct only one stale catalogue comment |
| A — native configuration/assets | `mobile/app.json`, `mobile/eas.json`, `mobile/assets/images/` | Retain byte-identically; running build unaffected |
| A — database history | Six files in `supabase/migrations/` | Retain byte-identically; six matching versions confirmed by read-only remote listing |
| B — development/test tooling | Root/mobile manifests, lockfiles, TypeScript configs, `next.config.ts`, `next-env.d.ts`, ESLint config, both test trees | Retain; no dependency or script removals |
| B — branding generator | `mobile/scripts/generate-brand-assets.cjs` | Retain; uses root Next.js Sharp dependency, no new runtime package |
| B — editor configuration | `mobile/.vscode/extensions.json`, `settings.json` | Retain Expo extension/editor actions |
| B — installed dependencies | Root/mobile `node_modules/`, `output/db-check/` | Retain; database runner imports its disposable PGlite installation |
| B/G — local development state | `.next/`, `mobile/.expo/`, `mobile/expo-env.d.ts`, `tsconfig.tsbuildinfo` | Ignored; retain current framework output/route declarations. Local process ownership could not be established safely |
| C — current documentation | Root/mobile README and AGENTS, PRD, implementation guides | Consolidate and retain |
| C — licence | `mobile/LICENSE` | Retain Expo template copyright/licence notice |
| D — historical records | TASK3_PHASE1, PHASE3_AUTH, CONTENT_AUDIT, MIGRATION_RECONCILIATION | Archive under `docs/history/`, label as historical, link current status |
| E — obsolete generated exports/reviews | Four old mobile export directories and four temporary review files under `output/` | Retained and ignored: automatic approval review rejected recursive removal; no runtime inputs |
| B/G — useful ignored output | `output/branding-audit/`, `output/tests/`, `output/npm-cache/` | Retain visual evidence, test output and cache; avoid disrupting active tools |
| F — Claude-only settings | `CLAUDE.md`, `mobile/.claude/settings.json` | Remove after references checked; only pointer/plugin activation, no Expo/Codex/build dependency |
| F — unused starter artwork | `mobile/assets/expo.icon/` (three files) | Remove; only internal self-references, current app uses FolioVale PNG assets |
| G — private local configuration | `.env.local`, `mobile/.env` | Retain without printing or changing values; both ignored |

No root `.github/`, `.vscode/`, `.claude/`, `dist/`, `coverage/`, `supabase/.temp/`, mobile `dist/`, `web-build/`, `android/` or `ios/` directories were present. No APK/AAB archives or .bak/.orig/.tmp files were found outside dependency/build internals. Git metadata was left untouched.

## Documentation consolidation

- Root README: current web/mobile architecture, identity, carts, payment, environments, migration state, EAS profiles and compliance.
- Mobile README: routes, native PKCE, guest merge retry/concurrency boundaries, Realtime lifecycle, checkout recovery and preview QA.
- AGENTS: current architecture, cart terminology, native auth and existing Realtime constraints.
- Mobile AGENTS: retain version-specific Expo documentation rules; add project-specific invariants.
- PRD: completed web/mobile scope and acceptance criteria, separate implementation from release evidence.
- Four historical documents moved with explicit banners; their old claims are historical, not current instructions.
- Detailed Lesson 3 mapping: [HNG15_LESSON3_COMPLIANCE.md](HNG15_LESSON3_COMPLIANCE.md).

## Ignore rules

Existing rules already exclude dependencies, Next/Expo output, local environments, output, coverage, Supabase temporary state and TypeScript caches. Add only anchored root/mobile APK and AAB patterns for local build copies. No source, migration, test or environment-example files are hidden.

## Dependencies and scripts

All scripts have a concrete development, test, build or platform-launch purpose; no duplicates require removal. No packages were installed, removed or version-changed in the application manifests/lockfiles.

Root `@vercel/analytics` has no source import and is a future removal candidate. `react-dom` is required by Next.js.

Mobile `@expo/ui`, `expo-device`, `expo-font`, `expo-glass-effect`, `expo-image` and `expo-symbols` have no direct application imports. Some participate in Expo Router/native tooling; absence of an import alone is not proof they can be removed. Keep the current native dependency set during the running-build checkpoint. `expo-dev-client` supports development builds; `expo-secure-store` and `expo-web-browser` are config plugins; `expo-system-ui` supports native configuration. React DOM/web and navigation/gesture/reanimated/worklets packages support framework/platform capabilities. Removal decisions require a separate native dependency/build review.

## Assets and source hygiene

Keep both public assets, all five FolioVale image assets, the canonical favicon and generator. Remove only the unused three-file Expo Icon Composer starter bundle. No redesign or regeneration.

Source searches found no production debug console.log/console.debug or TODO/FIXME markers requiring removal. Internal `Bag`, `bag-*` and `demo-note` identifiers are not customer-facing text and are retained to avoid refactoring. Product copy describing an everyday bag or study assignment dates has a legitimate stationery meaning. No visible checkout-testing disclosure remains. Preserve resilience fallbacks and useful comments.

## Security scan

Tracked text was scanned for Supabase secret keys, service-role/JWT credentials, Mailgun keys, Google client secrets, GitHub tokens, private keys and credential assignments. The only initial candidates were synthetic token fixtures in mobile tests; no actual private credential was identified. Environment examples contain empty credential placeholders and public URLs only. Local private environment files remain ignored and unchanged.

This is a scoped current-file pattern review, not a full Git-history or provider-credential audit. No secret values are included in reports.

## Retained generated artifacts

Automatic approval review rejected the recursive deletion command because it required an approval category disabled in this session. The following ignored artifacts remain unchanged: `output/mobile-final/`, `output/mobile-native/`, `output/mobile-web/`, `output/phase3-android/`, `output/mobile-audit.json`, `output/phase2b-review.md`, `output/phase3-native-config.json` and `output/phase3-review.md`. No workaround was used to force deletion. They are outside the tracked release changes.

## Evidence and limitations

Read-only remote history now matches all six local versions, including `20261006000100`. The preceding read-only comparison confirmed all 21 intended catalogue descriptions match live values. No database changes are needed or performed by this cleanup.

The owner reports development-build phone checks passed for Google sign-in, website add/quantity/removal synchronization and background recovery. No independent rerun or new physical-device test was performed during cleanup. Preview APK completion/QA and submission remain pending. The latest official submission form supersedes earlier guide wording: Task One requires a reviewer-accessible APK download link, the repository containing the mobile source and a single continuous video demonstrating the app with the existing website, including Web ↔ Mobile login and cart synchronization. Task Two requires a team/project PR link and a submission screenshot/picture; all Task Two evidence remains pending. Google Play / App Store publication is not required, but the APK download/submission link is required.

## Verification

| Check | Result |
| --- | --- |
| Root typecheck | Passed |
| Root tests | 39/39 passed |
| Root production build | Passed |
| Mobile TypeScript | Passed |
| Mobile lint | Passed |
| Mobile tests | 84/84 passed |
| Expo Doctor | 21/21 passed on final retry |
| git diff --check | Passed; line-ending notices only |
| Local Markdown links | All resolve |
| Historical archive bodies | Preserved beneath the new banners |
| Protected-file hashes | 95/95 unchanged |

Initial Doctor invocation also encountered a Windows npm-cache permission error; the successful retry uses a writable cache outside the repository, with no application dependency changes. The website build regenerated `next-env.d.ts`; it was restored to its exact pre-cleanup bytes.

Hashes confirm 95 protected source/configuration/asset/migration/environment files are unchanged. The only source edit is the catalogue comment. All local Markdown file links resolve. Current documentation/source searches found no listed stale migration names or phase-status phrases outside `docs/history/`.

## Needs human decision

- Complete the running preview build and final physical QA; upload the APK to Google Drive or another accessible service and verify reviewer download access.
- After an authorized final branch push, provide the repository link containing the mobile source.
- Record one single, continuous mobile-and-website demonstration showing the required login and cart synchronization behavior; submit all Task One evidence.
- Complete the separate team/project PR and provide its link plus a screenshot/picture showing submission, as required by the current form.
- Consider unused package candidates in a later authorized native dependency review.
- Clear retained local caches only when associated development/build processes are known to be idle.
