# HNG15 Lesson 3 compliance

The latest official Lesson 3 submission form, supplied by the project owner, is authoritative for submission requirements and supersedes older ambiguous guide wording. Current architecture and release status are in [README.md](../../README.md). Earlier guidance is preserved only as historical context under `docs/history/`.

## Task One — individual shop app

The current form requires all three submission items:

1. **APK download link:** upload the final APK to Google Drive or another accessible file-sharing service and provide a link that allows reviewers to download it.
2. **Repository link:** provide the GitHub/Git repository containing the mobile application source, including the final branch after it is pushed.
3. **Single continuous demonstration video:** show the mobile application working with the existing e-commerce website, including the required Web ↔ Mobile login and cart synchronization behavior.

| Requirement | Current implementation | Status | Evidence / verification | Remaining action |
| --- | --- | --- | --- | --- |
| Mobile counterpart | Expo Shop, Cart, Account and Checkout | Complete | `mobile/src/app/`; focused mobile tests | Final preview smoke test |
| Same backend/API | Existing website routes, current Bearer token | Complete | `mobile/src/lib/api-client.ts`, `api.ts`; `app/api/` | Keep production base URL |
| Same authentication/account | Same Supabase project and Google provider | Complete | `mobile/src/lib/supabase.ts`, `google-auth.ts`; owner-reported phone sign-in | Demonstrate login/account behavior across both clients |
| Web → mobile cart synchronization | Shared account cart; Realtime signal → API refetch | Complete | `cart-realtime.ts`, ShopProvider; owner reports web add, quantity and removal tests passed | Show required Web ↔ Mobile behavior in the video |
| Physical-phone testing | Android development build | Complete using development build | Owner-reported physical-phone tests, including background recovery | Validate final preview artifact |
| Launchable FolioVale icon | Native icon config and FolioVale book assets | Complete in development build | `mobile/app.json`, `mobile/assets/images/`; canonical `public/favicon.svg` | Check final preview launcher/splash on phone |
| Clean preview APK build | Existing EAS preview profile without development client | In progress / pending completion | Build previously reported running; completion not confirmed | Wait for the current build |
| Final preview APK physical QA | Install and test final artifact | Pending | No final preview QA evidence recorded | Verify launch without Metro, auth and shopping flows |
| APK download link | Reviewer-accessible APK file share | Pending until final APK is uploaded | No final download link recorded | Upload to Google Drive or another accessible service; check download access |
| Repository link | GitHub/Git repository containing mobile source | Available after final branch is pushed | Final branch submission link not confirmed | Push only when authorized, then provide the correct repository/branch link and reviewer access |
| Single continuous demonstration video | One uninterrupted demonstration with the existing website | Pending | No final video evidence recorded | Record, review and submit |

Physical-device results above are owner-reported checkpoint evidence, not tests repeated during documentation correction. Existing development-build results do not establish final preview-APK QA or completion of the video. No additional behavior is marked verified by this documentation update.

## Task Two — team/project submission

The current form says:

> For task two, submit the Link to your PR in your team's project and a picture to show your submission.

A **team/project PR link and submission screenshot/picture are required**. This supersedes earlier ambiguous PR guidance. This FolioVale checkout contains no evidence proving completion of the team's task; FolioVale branches and commits do not establish completion in another repository.

| Requirement | Status | Evidence / verification | Remaining action |
| --- | --- | --- | --- |
| Team PR | Pending; no completion evidence | No team-project PR recorded here | Complete and verify the PR in the team's project |
| PR link | Pending | No submission-ready PR URL recorded | Provide the team/project PR URL |
| Submission screenshot/picture | Pending | No submission picture recorded | Capture and submit a picture showing the submission |

The underlying team workflow remains a one-word article/body change without HTML/CSS/styling changes, using branch → commit → push → PR. Repository setup and that content-only diff remain unverified here. Do not mark Task Two complete without evidence. This documentation correction does not create a branch, commit, push or PR.

## Not required / optional enhancements

| Item | FolioVale status |
| --- | --- |
| Mailgun | Not required for Lesson 3; retained from Lesson 2 with sandbox restrictions |
| Google Play / App Store publication | Not required; distinct from the required APK download/submission link |
| Advanced Realtime/WebSocket synchronization | Optional enhancement; notification/refetch reconciliation is implemented |

## Final release and submission checklist

1. Wait for the current preview build; install the resulting APK on a physical phone.
2. Verify launcher/splash, startup without Metro/development controls, Google login, guest persistence/merge, account-cart reconciliation/background recovery, checkout confirmation/retries and local sign-out.
3. Upload the final APK to Google Drive or another accessible file-sharing service. Confirm reviewers can download it, then provide that link.
4. After the final branch is reviewed and pushed under separate authorization, provide the GitHub/Git repository link containing the mobile source and ensure reviewer access.
5. Record **one single, continuous video** showing the physical mobile app working with the existing website, including the required Web ↔ Mobile login and cart synchronization behavior. Review readability and unintended personal information.
6. Submit the APK download link, repository link and demonstration video for Task One.
7. Submit the team/project PR link and a screenshot/picture showing submission for Task Two.

Final preview QA, APK upload/link, final-branch repository link, video and Task Two evidence remain pending. No submission is claimed complete.
