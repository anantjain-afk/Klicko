# ClickPilot progress

Updated: 3 November 2026.

## Current status

Vercel website build repair: **AWAITING USER VERIFICATION**. The user-reported `tsc: command not found` failure came from a website lockfile with local links outside the Vercel root directory. A regenerated standalone lockfile passed clean install, build, and browser checks. The next Vercel build and live download URL still need verification. See the newest entry below.

Downloadable Chrome ZIP milestone: **VERIFIED by the user** on 3 November 2026. The packaging command builds the extension ZIP, copies it into the website, and enables the site download link. The user confirmed the package works and authorized committing and pushing these changes to `website`. Website deployment, store publication, and production resource changes remain unapproved. See the newest entry below.

Provider/model/user-key milestone: **VERIFIED by the user** on 29 October 2026. Gemini, OpenAI, and Groq retain separate saved model/key records; guidance and selected-text requests use only the active provider. The user confirmed the overwrite fix works and authorized committing and pushing these changes to `website`. ZIP packaging was approved later; website deployment remains unapproved. See the newest entry below for checks and limits.

Extension display-name change to Klicko: **VERIFIED by the user**, 28 October 2026. The user confirmed the name change in Chrome and authorized pushing it to `final-touchs`. The manifest name/action title, side panel, buddy, selection UI, status/error messages, accessible labels, and extension page titles now say Klicko. The two API instructions that identify the assistant also say Klicko so generated answers do not inherit the old product name. Internal `clickpilot` IDs, storage keys, package names, and protocols remain stable. No dependency or browser permission changed.

### Klicko name-change checks

| Exact command/check | Result |
| --- | --- |
| `corepack pnpm typecheck` | Exit 0. |
| `corepack pnpm lint` | Exit 0. |
| `corepack pnpm test` | Exit 0: 92 API and 130 extension unit tests passed. |
| `WRANGLER_LOG_PATH=/tmp/klicko-wrangler.log corepack pnpm build` | Exit 0: extension and API dry-run builds passed. The initial build also exited 0 but Wrangler could not write its default log inside the sandbox; setting the log path removed that warning. No deployment occurred. |
| `corepack pnpm exec playwright test tests/e2e/buddy.spec.ts tests/e2e/text-assistant.spec.ts tests/e2e/assistant.spec.ts --grep 'buddy opens locally\|no sharing without consent\|selection completes before\|6B forced worker loss' --workers=1 --output=/tmp/klicko-browser-results` | 3 passed, 1 failed. Buddy/sidebar and selected-text name paths passed. The existing 6B worker-recovery test stops at `.guidance-state`, a selector from the older panel layout; the current recovery status is rendered at `.chat-status`. The failure occurred before its renamed text assertion could be evaluated. The first sandbox run could not bind the fixture server; the permitted local run produced these results. |
| Search of extension source, extension unit tests, E2E tests, and assistant API instructions for `ClickPilot`; generated manifest inspection; `git diff --check` | No old product-name literals in those locations; manifest says `Klicko`; diff check passed. Test fixture page copy, historical docs and internal `clickpilot` identifiers were intentionally left as-is. |

**Manual Chrome verification**

1. Rebuild with `WRANGLER_LOG_PATH=/tmp/klicko-wrangler.log corepack pnpm build`, then reload the unpacked extension from `apps/extension/.output/chrome-mv3` at `chrome://extensions`. Expect its listed name and toolbar tooltip to say **Klicko**. Seeing ClickPilot means the old build is loaded.
2. Activate Klicko on an ordinary page and open the sidebar. Expect **Klicko** in the header, “Ask Klicko…” in the composer, and **Klicko** beside assistant replies. Open the floating buddy; expect **Klicko**, “Ask Klicko…” and “Hide Klicko.”
3. Select ordinary page text and use the selection bubble. Expect **Ask Klicko**. Check Settings and any access/reconnection messages encountered; none should display ClickPilot. If a label still does, report where it appeared and whether the extension was reloaded.

Klicko launch video artifact (separate from extension milestones): **AWAITING USER VERIFICATION**, 28 October 2026. The user requested a second-pass polish of the existing 25-second video and asked to use “Klicko” throughout the video and caption. `brag-output/brag.mp4`, `brag.jpg`, `share-copy.txt`, the second-pass plan, composition and local render scripts are complete. At the time of the video pass, the extension source and functionality were unchanged; the subsequent display-name change is recorded above. No dependencies, permissions, production resources or extension milestone status changed in the video pass.

### Launch video evidence

- Used the extension's actual `createCompanion()` robot SVG, its UI palette and project interaction sounds. The second pass adds blinking, eye tracking, head tilts, thinking and happy reactions, cursor-driven clicks, a drawn highlight, text-selection motion, camera moves and synthesized robotic chirps. `brag-output/second-pass-plan.md` records the approach.
- `/opt/homebrew/bin/node brag-output/work/render.cjs --stills` — exit 0; reviewed 26 stills spanning all scenes and transitions. A contact sheet and individual frames were inspected. `python3 brag-output/work/soundtrack.py` — exit 0; generated 25.0 seconds of 48 kHz stereo music and effects.
- `/opt/homebrew/bin/node brag-output/work/render.cjs --render` — exit 0; generated 600 1920×1080 frames and a separate hero poster. A decoded first-frame check found that the old render script had copied the closing poster into frame zero; this was corrected, all frames were rerendered and the video was re-encoded. `brag-output/work/assemble /Users/anantjain/Desktop/Projects/ClickPilot/brag-output` — exit 0.
- `brag-output/work/probe /Users/anantjain/Desktop/Projects/ClickPilot/brag-output/brag.mp4 /Users/anantjain/Desktop/Projects/ClickPilot/brag-output` — exit 0: 25.000 seconds, 1920×1080, 24 fps, audio present; decoded frames at 0, 9.6 and 23.3 seconds. `brag-output/work/audio-probe /Users/anantjain/Desktop/Projects/ClickPilot/brag-output/brag.mp4` — exit 0: 2,400,000 decoded samples, RMS 0.11305.
- `/opt/homebrew/bin/node --check brag-output/composition/film.js`, `/opt/homebrew/bin/node --check brag-output/work/render.cjs`, `python3 -m py_compile brag-output/work/soundtrack.py`, and `git diff --check` — exit 0. A text search found no remaining “ClickPilot” in the video-facing files. App typecheck, lint, tests and build were not run because no app code changed.
- Hyperframes was unavailable, so the brag plugin's local workflow used existing Chromium and macOS media tools. The website and UI are illustrative recreations labeled as a demo, not a live extension recording. The mascot animation uses the app's SVG fallback rather than its Rive runtime; the SVG has no articulated arms. No vertical cut was made.

**Chrome verification for the video**

1. Drag `brag-output/brag.mp4` into Chrome and press play. Expect the dark opening and the robot waking up within the first second. The closing hero card appearing as the first frame is a failure.
2. Watch 3–13 seconds. Expect the cursor to approach the buddy, open the ask box, type the domain question, then click **Settings** only after its green outline appears. The page should show **Domains** as the next highlighted step.
3. Watch 13–21 seconds. Expect the cursor to select text, click **Ask Klicko**, and reveal an explanation and sidebar reply. The buddy should blink, track the activity and transition from floating card to full sidebar.
4. Watch the final reveal with sound. Expect “Klicko”, “Your browser. A little smarter.” and “You make every click.” with clean music fade, readable text and no clipping. The poster `brag-output/brag.jpg` should show the final hero card.

Three-issue repair: **VERIFIED by the user** on 28 October 2026. After the global activation correction, the user confirmed “everything is working how it should” and authorized committing and pushing the changes to `final-touchs`. The recorded automated results and limitations remain unchanged; earlier status entries are historical.

Mascot visual redesign: **AWAITING USER VERIFICATION**, 27 October 2026. The approved UI refresh is implemented with a shared green workshop robot, warm light/dark surfaces and restrained interaction. Extension lint, 124 unit tests and build passed; three preexisting type errors and four distinct preexisting browser failures were reproduced on untouched HEAD. All six buddy workflows passed in both focused browser runs; combined runs finished 41/42 and 28/31. Exact evidence, visual review, limitations and numbered Chrome checks are recorded at the end. No backend tests, Git operations, deployment or next milestone were performed.

UX-2: **VERIFIED by the user**, 26 October 2026. The user explicitly confirmed “UX-2 is verified”. The minimal chat UI is implemented and manually verified by the user. The user explicitly requested manual verification and no tests; no unit/browser tests were added or run. Typecheck, lint, build, local empty-state visual previews and actual limitations are recorded in the UX-2 entry below.

UX-1: **VERIFIED by the user**, 25 October 2026. Approved reliability/onboarding scope implemented. Final typecheck/lint/build passed; **92 API + 119 extension unit tests** and **131/131 Chromium tests** passed. The UX-1 entry at the end records the root cause, changes, exact checks, visual evidence, limitations and numbered Chrome steps. The user confirmed UX-1 verification and approved the minimal UX-2 chat redesign; its current evidence is recorded in the UX-2 entry below.

Milestone 7A: **VERIFIED by the user**, 25 October 2026. Approved scope implemented, including strict distinct explanation/message variants and retained detailed panel replies when floating geometry is unavailable. Final checks: typecheck/lint/build passed; 92 API + 113 extension unit tests; 128/128 Chromium tests including the complete existing 6A/6B suite. Actual evidence and numbered Chrome checks are recorded below.

Milestone 6B: the user confirmed completion on 25 October 2026. The earlier report that it was unimplemented described the old checkout, not the existing 6B branch. Before coding 7A, Git inspection found clean `milestone-7A` at `79aaf6c`, one worktree, and local/origin `milestone-6B` at `109e04f`. That direct-descendant commit contains the completed 6B code/tests/docs. The 7A branch was fast-forwarded to it; no new commit, push, fetch or deployment occurred. The prior 6B AWAITING USER VERIFICATION entry is retained as historical evidence; this update records the user's current completion confirmation, without inventing new agent-run Chrome results. The separate popup verification record is not changed.

Milestone 6B: explicitly approved on 23 October 2026 by “ok , continue with 6B”. Implementation is **AWAITING USER VERIFICATION**; evidence and numbered Chrome checks are below. No commit, push, deployment, publication or later milestone is authorized.

Dynamic popup observation correction: remains separately **AWAITING USER VERIFICATION**; 6B approval does not verify it.

Planning: REVIEWED — user approved starting milestone 1.

Milestone 1: VERIFIED by user.

Milestone 2: AWAITING USER VERIFICATION.
Milestone 3: VERIFIED by the user in Chrome on 21 October 2026.
Milestone 4: AWAITING USER VERIFICATION — explicitly approved by the user on 21 October 2026.
Milestone 5A: VERIFIED by the user on 22 October 2026.
Milestone 5B: VERIFIED by the user on 22 October 2026. Its relevant branch handoff was authorized. Milestone 6A was subsequently verified as recorded below; 6B was separately approved on 23 October 2026. Deployment remains unapproved.
Milestone 6A: implementation approved on 22 October 2026 after the continuation clarification. **VERIFIED by the user on 23 October 2026**, including the shared highlighting correction. Evidence and limitations are recorded below.
Shared highlighting correction: approved and **VERIFIED by the user on 23 October 2026**. The user authorized committing and pushing these changes to `milestone-6A`. The later 6B authorization is recorded below; it does not authorize Git operations.

The user confirmed milestone 1 in Chrome and explicitly authorized milestone 2 on 21 October 2026. The user then reported that inspection failed on the localhost fixture in both Brave and Chrome. A focused milestone 2 fix is implemented and automated checks pass. The user subsequently said “ok let's continue with milestone 3,” explicitly authorizing that scope. Work proceeded on milestone 3; no manual milestone 2 pass is inferred from that authorization. Verify inspection and overlays together in Chrome (and Brave if used).

After verifying milestone 3 in Chrome, the user said “great , continue with milestone 4.” That authorizes the local mock guidance scope only. Milestone 4 is implemented and awaiting manual verification. Milestone 2's separate privacy checks and Brave results remain unconfirmed.

The user subsequently said “ok , now continue with milestone 5A,” explicitly authorizing the local API contract. Work proceeded only on that approved scope. This does not create a recorded manual pass for milestone 4 or authorize Gemini calls, deployment, or extension host permissions.

## Completed planning work

- Read `AGENTS.md` in full and adopted its coding, privacy, testing, and human approval requirements.
- Read `docs/clickpilot-production-architecture.md` in full. `docs/architecture.md` is absent; the existing architecture document remains unchanged.
- Created `PLAN.md` with independently verifiable milestones, likely file ownership, acceptance criteria, automated-check expectations, numbered manual steps, and approval gates.
- Split backend validation from real Gemini integration, and outcome verification from lifecycle recovery, to keep changes reviewable.
- Kept screenshot fallback optional, permissions incremental, and safety checks part of each relevant slice.

## Milestone ledger

| Milestone | Scope | Status | User verification |
|---|---|---|---|
| Planning | Architecture review, PLAN.md, PROGRESS.md | REVIEWED | User approved starting milestone 1 |
| 1 | Extension foundation and side panel | VERIFIED | User confirmed in Chrome |
| 2 | Safe compact DOM observation | AWAITING USER VERIFICATION | Pending user Chrome check |
| 3 | Highlight, arrow, tooltip | VERIFIED | User confirmed correct targets, aligned geometry, click-through, invalidation, and cleanup in Chrome |
| 4 | Mocked single-step guidance | AWAITING USER VERIFICATION | 21 unit tests and 34 browser tests passed; manual Chrome check pending |
| 5A | Local backend contract and validation | VERIFIED | User confirmed verification on 22 October 2026; prior automated evidence remains recorded |
| 5B | Conversational Gemini replies with single-step visual guidance | VERIFIED | User confirmed manual verification on 22 October 2026; 55 mocked API + 37 extension unit tests; 55 Chromium tests; five actual local HTTP checks; four real Gemini outcome smoke cases passed |
| 6A | AI-driven multi-step guidance with temporary task context | VERIFIED | User verified 6A and the shared highlighting correction on 23 October 2026 |
| 6B | Navigation and lifecycle recovery | AWAITING USER VERIFICATION | Approved on 23 October 2026; implementation and actual evidence below |
| 7A | Contextual text assistant | VERIFIED | User confirmed all manual checks on 25 October 2026 |
| 7 | Optional screenshot fallback | NOT APPROVED — OPTIONAL | Not run |
| 8 | Security review and release preparation | NOT APPROVED | Not run |

## Evidence and limitations

### Milestone 5A implementation

- Added `apps/api` with a local Hono Worker exposing `POST /v1/guidance/next`. Its runnable entrypoint has no provider configured and returns an explicit HTTP 503 `provider_unavailable` for valid requests. Deterministic provider functions exist only in tests through `createApp` injection; no mock success is presented as AI.
- Added `packages/shared/src/guidance.ts` with strict Zod request/response/error schemas, payload limits, allowlisted roles/operations/outcomes/result variants, session/request/page/snapshot identity checks, and membership validation against the filtered inventory. Internal browser messages remain unchanged; no extension source file was modified.
- Added `packages/shared/src/privacy.ts` to build a separate minimal provider context: origin only, task, eligible control IDs/roles/names/context. It omits URL paths/query/fragment, geometry, viewport, local identity, disabled/unnamed controls, and sensitive-looking labels/context; rejects credential URLs, selected sensitive paths/goals, and known sensitive output text. This is a heuristic, not a guarantee against arbitrary private prose.
- Added actual-byte streaming limits (64 KiB, independent of Content-Length), UTF-8/JSON validation, forbidden-field rejection at each schema object, uncompressed JSON-only input, static safe errors, no application body logging, no-store/nosniff responses, loopback-only request hosts, and no CORS permission. There are no auth/storage bindings or remote fetch calls.
- Explained and installed Hono `4.13.13` (routing), Zod `4.6.7` (runtime validation/contracts), Wrangler `4.151.3` (local Worker/build tooling). Reused pinned TypeScript and Vitest. Added the shared workspace and root scripts covering API/shared checks, local development, and HTTP verification. Ignored local Wrangler output and future secret-file names.
- Added 38 API/shared-contract tests and a six-case HTTP verification script with a synthetic valid request fixture. Added `docs/local-api.md` with exact local commands, limits, error behavior, official sources, privacy limitations, and verification steps. Updated README, plan, and progress.
- No extension permission or behavior changes, Gemini integration, credentials, deployment, public hosting, provider quotas, database, authentication, screenshots, milestone 5A commit, or push. Earlier milestone Git authorizations do not apply to this new scope.

### Milestone 5A checks

- `corepack pnpm view hono version`, `corepack pnpm view zod version`, `corepack pnpm view wrangler version` — exit 0 with network access, used to pin the installed versions. Initial sandboxed metadata lookup failed with `ENOTFOUND`; it did not establish any package version.
- `corepack pnpm install` — exit 0; installed dependencies and updated the lockfile. pnpm reported ignored build scripts for esbuild/workerd; no build-script approval was added, and the resulting local builds and workerd verification succeeded.
- `corepack pnpm typecheck` — exit 0 across shared, extension, and API workspaces. Initial API test typing failed on a union of header object shapes; explicit `Headers` objects fixed it. Log: `/tmp/clickpilot-5a-typecheck.log`.
- `corepack pnpm lint` — exit 0. Initial lint flagged intentional control-character matching; a local rule exception with an explanatory comment preserves the privacy normalization without disabling the rule globally.
- `corepack pnpm test` — exit 0; 59 tests passed: 21 extension tests in three files and 38 API tests in one file. API coverage includes malformed/oversized bodies, absent/false Content-Length and chunked cancellation, UTF-8 errors, label/count/role/geometry/identity bounds, forbidden nested fields, unknown/filtered/disabled targets, result variants/outcomes, hostile page/model strings, sensitive context, provider exceptions, no network calls/body logging, and stale response identity.
- `corepack pnpm build` — exit 0 with local tooling access. Built the unchanged extension plus `wrangler deploy --dry-run --outdir dist` for the API. Wrangler reported no bindings and `--dry-run: exiting now`; no upload/deployment occurred. Initial sandboxed invocation built the extension but failed Wrangler's required filesystem access under `~/Library/Preferences/.wrangler`. Log: `/tmp/clickpilot-5a-build.log`.
- `corepack pnpm dev:api` — successfully started workerd locally on `127.0.0.1:8787` with no remote bindings. Initial sandboxed attempt failed on local tooling writes and loopback inspector binding. The successful server used local tooling access outside the sandbox. Log: `/tmp/clickpilot-5a-dev.log`; inspection after verification found no request bodies, fake secrets, or provider data.
- `corepack pnpm verify:api` — exit 0 against the actual local Worker: valid fixture → 503 provider_unavailable; malformed JSON → 400 invalid_json; oversized body → 413 payload_too_large; forbidden field → 400 invalid_request; excessive label → 400 invalid_request; sensitive goal → 422 unsafe_context. This verifies the real provider-free entrypoint, separately from injected test providers.
- `corepack pnpm exec playwright test` — exit 0; all 34 Chromium regression tests passed in 47.5 seconds, including unchanged Mock guidance and its no-backend-traffic check.
- `corepack pnpm exec wrangler telemetry status` from `apps/api` — exit 0; **Disabled (set by wrangler config)**. Checked after Wrangler displayed a generic first-run telemetry banner. No global telemetry preference was changed; project config also disables observability, workers.dev, and preview URLs.
- `git diff --check` — exit 0. Extension source diff is empty; built manifest remains MV3 with exactly `activeTab`, `scripting`, `sidePanel`, no host permissions and no static content scripts.
- Manual user verification: CONFIRMED by the user on 22 October 2026: “5A verification is done”. This records the user’s reported result; the agent did not perform their manual check.

### Milestone 5A known limitations

- No real guidance provider, provider timeouts/cancellation, quota controls, hosting, or client API calls exist yet. These belong to separately approved milestone 5B or later hosting work. A 503 for valid input is the intended successful contract check.
- Privacy pattern matching cannot establish that arbitrary text is non-sensitive. Client-side minimization before backend upload remains mandatory when extension integration is introduced. Current tests use synthetic data only.
- Hono tests run in Node; six HTTP cases also ran in actual local workerd. Browser regression tests use panel HTML in a tab, so normal Chrome/Brave side-panel verification remains manual. No hosted runtime or broad live-site behavior is claimed.

### Milestone 4 implementation

- Added a default **Mock guidance** view with a bounded task form, explicit status, **Stop**, **Retry**, **Replace guidance**, and documented local scenarios. The existing milestone 3 inspection/highlight UI is preserved under **Manual highlights**. Switching modes unmounts and cancels the previous controller.
- Added `src/features/session/mock.ts`: a fixed local selector supports the documented fixture tasks and exact control names/contexts. It refuses other pages, asks for clarification when multiple controls match, and reports missing or unsupported requests honestly. Mock eligibility is derived from the content script's real URL: HTTP on `127.0.0.1:4173` or `localhost:4173`, path `/guidance.html`; no webpage attribute can enable it elsewhere.
- Added `src/features/session/session.ts`: the panel owns one active run with a random session ID, increasing request numbers, explicit observing/selecting/highlighting/waiting/paused/error/stopped/clicked states, and an AbortController for delayed selection. Stale async replies and click messages cannot advance a superseded run. Cleanup is scoped to a snapshot so a late old reply cannot clear newer guidance. Invalid target membership or failed live highlight gets at most one fresh observation; persistent failure pauses.
- Extended runtime message validation for scoped cleanup, optional guidance identity, fixture eligibility, and click acknowledgement. The content script observes trusted browser clicks on the current highlighted target or its descendants, reads no input values, and never prevents the click's normal behavior. Synthetic `.click()` events and unrelated controls do not acknowledge guidance. A click clears decoration and yields “Click observed” with an explicit statement that task completion has not been verified.
- Reused milestone 3's live target checks and pointer-transparent Shadow DOM overlay. Added cleanup for click listeners, pending selections, page/tab changes, Stop, mode changes, and panel closure. The background retains the panel's last owned tab even if reinjection replaces the content connection, so panel closure can still clear the current registry. Explicit pagehide disconnection supplements normal port shutdown.
- Added `tests/fixtures/guidance.html` and 12 browser workflows in `tests/e2e/guidance.spec.ts`; retained and reran both inspection tests and the complete 20-case overlay matrix. Added 13 session/selector unit tests and one message-validation test; existing tests still pass. Updated README, plan, and test documentation.
- No new packages, permissions, host permissions, backend, AI requests, screenshots feature, persistence, autonomous browser actions, milestone 4 commit, push, or deployment. The earlier milestone 3 commit remains local; its push was rejected by automatic approval review and was not retried as part of this milestone.

### Milestone 4 checks

- `corepack pnpm typecheck` — exit 0 on final source. Output redirected to `/tmp/clickpilot-m4-typecheck.log`. Strict production and unit-test TypeScript checks passed.
- `corepack pnpm lint` — exit 0.
- `corepack pnpm test` — exit 0; 3 test files, 21 tests passed. New checks cover fixture gating, task normalization, ambiguity/missing/disabled controls, malformed output, session/request/snapshot identity, trusted click message shape, scoped old-snapshot cleanup, bounded refresh, delayed cancellation, replacement, navigation invalidation, and a late highlight reply after Stop.
- `corepack pnpm build` — exit 0; updated MV3 output at `apps/extension/.output/chrome-mv3`. Output redirected to `/tmp/clickpilot-m4-build.log`.
- `corepack pnpm exec playwright test` — exit 0; 34 tests passed on final code (12 guidance, 20 overlay, 2 inspection), 43.9 seconds. Actual workflow results are listed in `docs/guidance-test-matrix.md`. The successful tests ran with local browser/server access outside the sandbox.
- Initial unit run: 1 failed, 18 passed. A trailing-space/question-mark normalization issue caused a supported request to be rejected. Trimming before punctuation removal fixed it; final unit suite passes.
- Initial sandboxed browser command failed before tests: localhost port 4173 binding was denied. The successful browser runs used permitted local server/browser access. This failed invocation is not a passing check.
- First completed browser suite: 32 passed, 2 failed. Full navigation raced a generic target-invalidation message, and panel-close cleanup missed a current registry created by reinjection outside the panel's displayed snapshot. A focused two-test rerun passed navigation but still failed closure. A synthetic local diagnostic confirmed that reinjection disconnected the content port before panel closure. Retaining the last owned tab and explicitly clearing it on panel disconnection fixed the regression; the final full suite passed all 34.
- `git diff --check` — exit 0. Manifest verification confirmed MV3 with exactly `activeTab`, `scripting`, `sidePanel`, and no host permissions or manifest content scripts.
- Visual QA: inspected valid local screenshots at `/tmp/clickpilot-m4-waiting-360.png`, `/tmp/clickpilot-m4-waiting-260.png`, and `/tmp/clickpilot-m4-page.png`. Both panel widths fit without horizontal overflow. The independent scoped finish review returned **ship for user verification**, subject to final browser results, which now pass. The documentation comparison found no material mismatch with the existing design or README. The previously unavailable Impeccable context engine/detector was not installed or rerun.
- Manual Chrome/Brave verification of milestone 4: NOT RUN by the agent; PENDING USER VERIFICATION. Headless Chromium opens panel HTML in a separate tab, so actual side-panel placement, browser lifecycle differences, and real-user console inspection remain manual checks.

### Milestone 4 known limitations

- This is a local, deterministic, fixed-task mock; general questions and live third-party pages are unsupported. It does not prove AI selection accuracy, verify page outcomes, advance multiple steps, resume after panel closure, or use backend/network services.
- A trusted click is only an acknowledgement. It is not proof the requested action succeeded. Subsequent navigation may replace the status with a page-change message; it never claims verified completion.
- Retry repeats the last submitted task and scenario, with fresh observation; change the dropdown and submit again to choose a different scenario. Automatic recovery is limited to one refresh per run.
- The existing overlay/observer limitations remain: top-level DOM controls only, sampled coverage checks, and conservative removal of clipped/unplaceable targets. One-minute snapshot expiry is implemented but not timed by the new browser suite. No continuous performance or broad-site claim is made.
- Real Chrome verification of milestone 4 is required before marking it complete. Backend work remains unapproved; milestone 2's separate privacy confirmation and Brave verification remain unrecorded.

### Milestone 3 implementation

- Added `apps/extension/src/features/overlay/renderer.ts`. It creates one Shadow DOM with a CSS outline, SVG arrow, and text-only tooltip. Every decoration is pointer-transparent. It reads live viewport CSS geometry on each animation frame and does not scroll, click, type, focus, or navigate the page.
- Before drawing, it checks registry membership, document/snapshot identity, connectivity, ancestor visibility/inert state, disabled state, geometry, viewport bounds, and center/corner hit tests. Invalid, covered, clipped, offscreen, disabled, or unplaceable targets clear or return an honest failure. The outline's rendered position is checked to reject coordinate drift caused by unusual host positioning.
- Added bounded, runtime-validated highlight messages through the existing panel/background/content path. Background checks the active tab before and after routing. Invalidations include page/snapshot identity and target ID, preventing a delayed old-target event from clearing a newer selection's status.
- Added per-row **Highlight** buttons, selected styling, accessible status, and **Stop** in the existing panel. It remains clearly labelled manual debug mode. The panel chooses exact IDs so duplicate names remain distinct; disabled rows cannot be selected.
- Added a panel → background → content connection for cleanup on panel or worker disconnection. The registry still expires after one minute; SPA identity checks run only while a snapshot is retained. Stop, reinspection, expiry, navigation, tab changes, panel disconnection, and WXT invalidation clear appropriate active work. Overlay animation callbacks and lifecycle listeners are removed when drawing stops; the idempotent content listener stays available for later inspections.
- Added `tests/fixtures/overlay.html` with duplicate Settings, a click counter, input, nested scroller, move/hide/remove/cover actions, and SPA/full navigation. Added a numbered 20-case browser suite, shared browser-test setup, bounded message-validation tests, and `docs/overlay-test-matrix.md` with actual results. Updated README and plan status.
- No new permissions, dependencies, backend, AI integration, or screenshot feature. The user subsequently authorized committing and pushing this milestone to `milestone-3`; no merge or deployment is authorized.

### Milestone 3 checks

- `corepack pnpm typecheck` — exit 0 on the final code. The initial run failed on an inferred numeric-array type in hit-test points; declaring explicit `[number, number]` pairs fixed it. WXT's verbose output was redirected to `/tmp/clickpilot-typecheck.log` on later runs.
- `corepack pnpm lint` — exit 0.
- `corepack pnpm test` — exit 0; 2 files, 7 tests passed. New checks reject missing identity, malformed target IDs, empty/oversized instructions, invalid overlay replies, and malformed connection messages. Existing privacy/extraction checks still pass.
- `corepack pnpm build` — exit 0; production output at `apps/extension/.output/chrome-mv3`. Build output was redirected to `/tmp/clickpilot-build.log`.
- `corepack pnpm exec playwright test` — exit 0; 22 browser tests passed, including all 20 overlay matrix cases and both existing inspection tests. Ran against the rebuilt extension, including the final target-invalidation scoping patch. An earlier completed matrix also passed; the final rerun verified the lifecycle patch and strengthened the registry-discard assertion.
- The initial sandboxed Playwright invocation failed before tests because the local server could not bind port 4173 (`PermissionError: Operation not permitted`). The successful browser commands ran with local browser/server access outside that sandbox. This limitation is not recorded as a passing invocation.
- `git diff --check` — exit 0. Production manifest inspection confirmed exactly `activeTab`, `scripting`, and `sidePanel`, with no host permissions or manifest content scripts.
- Visual inspection: reviewed local synthetic screenshots at `/tmp/clickpilot-overlay-desktop.png` (1100×800), `/tmp/clickpilot-panel-360.png`, and `/tmp/clickpilot-panel-260.png`. The existing cream/green panel design was preserved and the narrow layout showed no horizontal overflow. An independent scoped finish review returned **ship**, subject to final lifecycle checks and manual user verification. The Impeccable context loader/detector was unavailable because its engine cache was not installed in a writable location; existing project code supplied the design context.
- Manual Chrome verification: PASSED by the user, who confirmed correct target selection, aligned geometry, click-through behavior, invalid-target clearing, and cleanup. This is user-reported verification; the agent did not perform the manual check. Brave verification remains unconfirmed.

### Milestone 3 known limitations

- Top-level ordinary DOM controls only; iframe, shadow-tree, and canvas targeting remain excluded. Browser top-layer modals/popovers and unusual transforms are outside the verified fixture matrix and may obscure or invalidate decoration.
- Five hit-test samples detect common coverage/clipping, not every possible partial obstruction. The renderer removes partial viewport targets and targets without sufficient tooltip space rather than scrolling automatically.
- Matrix zoom coverage is actual 125% tab zoom and one viewport resize, not every zoom/display scale. One-minute registry expiry is implemented but not timed by this matrix. No broad live-site accuracy or performance claim is made.
- Panel disconnection conservatively clears the registry. Reopen the panel and inspect again if the connection closes. Successful inspection and overlay operation in normal Chrome/Brave remain user checks.

### Milestone 2 implementation

- Added `scripting` permission for on-demand injection into the toolbar-activated tab. The built MV3 manifest has exactly `activeTab`, `scripting`, and `sidePanel`, with no host permissions or always-on content scripts.
- The background checks the active tab, injects a WXT runtime content script, validates its bounded response, and rejects unsupported pages, lost access, or tab changes. The content script keeps temporary element references locally, refreshes page identity when the URL changes, and clears its registry on request or after one minute.
- The collector returns at most 150 visible controls with ephemeral IDs, short accessible names, roles, safe landmark context, disabled state, and viewport rectangles. It does not read field values, password/payment inputs, editable content, cookies, or full HTML. The side panel shows the list locally and offers an explicit Clear action.
- Added a synthetic fixture, Vitest/jsdom unit tests, and a Playwright check of the built extension's restricted-page error. Vitest is needed to exercise DOM filtering; Playwright is needed for real extension and browser behavior. Existing typecheck/lint cannot verify either. No backend, AI, screenshot, or overlay was added.

### Milestone 2 checks

- `corepack pnpm install` — exit 0; installed the pinned Vitest, jsdom, and Playwright test packages.
- `corepack pnpm typecheck` — exit 0 after correcting WXT's public paths and a narrowed TypeScript record type.
- `corepack pnpm lint` — exit 0; no lint errors.
- `corepack pnpm test` — exit 0; 2 test files, 6 tests passed. Checks cover visibility, accessible names, duplicate context, sensitive value omission, disabled state, list cap, and malformed messages.
- `corepack pnpm build` — exit 0; built Chrome MV3 extension with a runtime content script. Manifest inspection confirmed only `activeTab`, `scripting`, and `sidePanel` permissions, with no host permissions or manifest content scripts.
- `corepack pnpm exec playwright install chromium --no-shell` — exit 0; installed Playwright's bundled Chromium for local testing.
- `corepack pnpm exec playwright test` — exit 0; 1 browser test passed, verifying a restricted page shows an explicit error.
- An initial `corepack pnpm test:e2e` failed because the sandbox blocked the local fixture server from binding to port 4173. Running the Playwright check with local server access succeeded. A further attempt to automate the toolbar grant with `Extensions.triggerAction` failed because Playwright's page-level CDP session does not allow that browser-level method. That attempt was removed from the committed test; the successful `activeTab` path remains a manual Chrome check.
- Manual Chrome verification of successful inspection: NOT RUN by the agent. The user must confirm the fixture result and permission behavior.

### Milestone 2 inspection failure and fix

- User-reported failure: Brave showed “This page cannot be inspected” on `http://127.0.0.1:4173`; Chrome showed “The inspection response was invalid.” Both mean milestone 2 verification failed.
- Chrome cause: background messaging returned a Promise from `runtime.onMessage`, and the content listener returned a value. These reply forms are not compatible with all Chrome/Brave versions. Both listeners now use `sendResponse`; the background returns literal `true` to keep its asynchronous response channel open.
- The toolbar action now explicitly opens the side panel, so the browser's `action.onClicked` gesture grants temporary `activeTab` access. It also disables the previous automatic-opening behavior on startup so reloading an older installation uses the new path. A tab with no readable URL now produces the reactivation instruction; a known non-HTTP(S) URL produces the unsupported-page message. No permission or dependency was added.
- `playwright.config.ts` now reuses the local fixture server if it is already running. A new browser test invokes the toolbar action on the fixture and checks the resulting seven-control list. This tests the permission, background, content-script, and panel message path in Playwright Chromium. Playwright headless opens the panel HTML in a tab for inspection after activating the website tab; actual side-panel placement still requires manual verification.
- `corepack pnpm typecheck` — exit 0 after the fix.
- `corepack pnpm lint` — exit 0 after the fix.
- `corepack pnpm test` — exit 0; 2 files, 6 tests.
- `corepack pnpm build` — exit 0; produced the updated Chrome MV3 build.
- `corepack pnpm exec playwright test` — exit 0; 2 browser tests passed, including restricted-page behavior and successful localhost fixture inspection. An initial sandbox run could not bind port 4173. An elevated run first found the user's existing fixture server on that port; after enabling server reuse, the browser check passed.
- An additional one-off `node --input-type=module` Playwright smoke check launched the locally installed Brave browser with an isolated profile, triggered the extension action on `http://127.0.0.1:4173`, and received “Visible controls (7)” — exit 0. This confirms the Brave messaging and tab-access path in automated headless testing, but does not prove actual side-panel placement in a normal Brave window.
- A corresponding one-off test of the installed Google Chrome binary could not run the extension path: its isolated headless session did not start the extension service worker within 30 seconds (exit 1). This is an automated-test limitation, not a passed Chrome check; the bundled Playwright Chromium test did pass.
- Manual Chrome and Brave verification by the user: PENDING. Milestone 2 remains AWAITING USER VERIFICATION.

### Milestone 1 and planning evidence

#### Milestone 1 implementation

- Added a pnpm workspace with one WXT extension package, pinned dependencies and lockfile, strict TypeScript, ESLint, and a production build script. WXT is needed to build the MV3 extension; React renders the panel; TypeScript checks source; ESLint checks code quality. No Tailwind or test framework was needed for this first slice.
- Added a Chrome MV3 background entrypoint that enables toolbar click to open the side panel. Added a React side panel with an honest foundation state and plain CSS. It contains no working guidance controls or page access.
- Added `.gitignore` for dependencies and WXT output. Updated the README with actual install, check, build, and Chrome loading steps.
- WXT automatically adds `sidePanel` for its side-panel entrypoint. The only explicitly requested permission is `activeTab` for the toolbar activation flow that milestone 2 will use. The built manifest has exactly `activeTab` and `sidePanel`, and no host permissions or content scripts.

#### Milestone 1 checks

- `corepack pnpm install` — exit 0; installed 230 packages using pnpm 10.34.7 and generated `pnpm-lock.yaml`.
- `corepack pnpm typecheck` — exit 0 after correcting the local Corepack script and TypeScript config. It runs `wxt prepare && tsc --noEmit` with strict mode.
- `corepack pnpm lint` — exit 0; ESLint reported no errors.
- `corepack pnpm build` — exit 0; WXT 0.21.4 built `apps/extension/.output/chrome-mv3` for Chrome MV3.
- A Node inspection of the production output — exit 0; asserted MV3, side-panel path, toolbar title, exact `activeTab`/`sidePanel` permissions, no host permissions/content scripts, background `openPanelOnActionClick`, and no `AIza`, `GEMINI_API_KEY`, `captureVisibleTab`, or `executeScript` markers.
- Initial `corepack pnpm typecheck` and `corepack pnpm build` runs failed because root scripts invoked a missing standalone `pnpm`; root scripts now invoke Corepack. A later typecheck failed because the TS config `extends` path lacked `./`, JSX was unset, and direct `chrome` types were absent. Those issues were corrected and the final commands above passed. The first typecheck and build also ran concurrently against WXT's generated files; final checks ran sequentially.
- Unit tests: NOT RUN; no pure behavior exists yet, so adding a test that mirrors static render code would add little value. Vitest is planned for milestone 2.
- Playwright/browser automation: NOT RUN; scheduled for milestone 2 when page interaction begins. Static checks cannot prove that a user sees the panel.
- Manual Chrome verification: confirmed by the user before milestone 2 began.

#### Earlier planning evidence

- `cat AGENTS.md` — exit 0; read project instructions.
- `rg --files --hidden -g '!.git/**' -g '!node_modules/**' -g '!.agents/**' -g '!.codex/**'` — exit 0; initial project inventory contained only `AGENTS.md` and `docs/clickpilot-production-architecture.md`.
- `cat docs/clickpilot-production-architecture.md` — exit 0; read architecture.
- Documentation structure check — exit 0; verified 10 milestone sections, corresponding ledger/manual verification entries and approval gates, and the architecture filename. A repeatable summary check passed with this exact command:

  ```sh
  python3 -c 'from pathlib import Path; p=Path("PLAN.md").read_text(); s=Path("PROGRESS.md").read_text(); assert p.count("## Milestone ")==10; assert p.count("**Gate:**")==10; assert "AWAITING USER VERIFICATION" in s; print("PASS: 10 milestones, 10 approval gates, pending verification status")'
  ```

- `cat README.md` — exit 0; reviewed the README that appeared after the initial inventory. It remains unchanged; its broad roadmap is consistent with the plan, while its architecture path and Tailwind reference retain the differences noted in `PLAN.md`.
- At the planning stage, typecheck, lint, unit tests, browser tests, and build could not run because no application existed. Milestone 1 check results are recorded above.
- External API details, model availability, quotas, prices, and provider terms: NOT VERIFIED. Verify current official sources during the relevant approved implementation milestone.
- At the planning stage, Git status resolved through an unrelated ancestor repository under `/Users/anantjain`. On 21 October 2026, the user explicitly authorized adding the ClickPilot GitHub remote and pushing milestone 1 to a `milestone-1` branch, with only relevant ClickPilot files. A project-local Git repository is required to keep the ancestor repository untouched. This permission does not approve merging into `main`, publishing, or later milestone work.

## Remaining decisions and limitations

- Verify milestone 5A using the steps below; earlier milestone 4 manual confirmation and milestone 2's separate privacy results remain unrecorded. If verification fails, fix the current approved scope and rerun relevant checks. Do not begin real Gemini milestone 5B without user verification and explicit approval.
- Architecture filename differs from the requested path. Future work should read the existing source named above unless the user chooses to rename it.
- Browser permission and lifecycle behavior must be verified against real Chrome; passing pure-function tests alone is insufficient.
- Live Gemini testing later requires backend-only credentials and an account with the selected model available. Public hosting requires separately approved deployment and demonstrated abuse/budget controls.
- No milestone is complete until the user confirms verification. Approval of milestone 1 did not authorize later milestones.

## User verification for milestone 2

1. From the project root, run `corepack pnpm build`. Reload ClickPilot on `chrome://extensions` (and on `brave://extensions` if testing Brave). If the fixture server is not already running, start `python3 -m http.server 4173 --directory tests/fixtures` in a separate terminal. Open `http://127.0.0.1:4173` in Chrome. Click the ClickPilot toolbar icon on that tab, then **Inspect this page**. Expect a list with Profile, Next page, two Settings controls in different contexts, Open help, Unavailable marked disabled, and Search projects. A blank list or error here is a failure.
2. Type a distinctive fake marker into the Search projects input and the editable region, then inspect again. Expect neither marker, the fixture password value, nor Hidden control in the list. Any of those appearing is a privacy failure.
3. Click Inspect several times, then Clear. Expect a fresh list on each inspection and an empty panel after Clear. Inspect the first page again, then click its **Next page** link and inspect again. Expect the old list to clear, and the new list to contain only Return to first page and Second page control; old Settings entries or duplicate rows mean failure. Inspect the page/worker console for errors if this fails.
4. Switch tabs, open `chrome://extensions`, and navigate the fixture tab to a different origin in separate runs. Expect the list to clear or an unsupported/reactivation message. On a new origin, click the extension toolbar icon again before inspecting. An in-panel button must not silently obtain access.
5. Check the page and Network panel. Expect no page clicks, typing, navigation, backend requests, or screenshots caused by ClickPilot. Any such effect fails verification.
6. Repeat step 1 in Brave after reloading the same build on `brave://extensions`. Expect the same seven-control list. If either browser still fails, record the exact visible message and inspect that browser's extension service-worker errors; milestone 2 remains pending.

Milestone 3 was subsequently authorized explicitly; milestone 2's manual result remains unconfirmed. The current UI uses **Stop** in place of **Clear**. No commit or push for milestone 2 or 3 is authorized by the earlier milestone 1 Git permission.

## User verification for milestone 3

Status: VERIFIED by the user in Chrome. These steps are retained for regression checks. Rebuild/reload before checking. Reload and reinspect the fixture between destructive cases; lists expire after one minute.

1. Run `corepack pnpm build`, reload ClickPilot on `chrome://extensions`, and refresh the fixture tab. Start `python3 -m http.server 4173 --directory tests/fixtures` if needed, then open `http://127.0.0.1:4173/overlay.html`. Click the toolbar icon on that tab, then **Inspect this page**. Expect the control list and manual debug status. A blank/error result fails inspection; check extension **Errors**, the service-worker console, panel console, and page console.
2. Choose **Highlight** beside **Primary target**. Expect one green outline on that exact control, an arrow pointing at it, and a readable tooltip. The fixture must still say **Clicks: 0** and the page must not scroll itself. Highlight each **Settings** row: the navigation row must outline navigation Settings, and the Preferences row must outline dialog Settings. Wrong targets, duplicate overlays, or unsolicited page actions fail.
3. Click Primary target yourself. Expect **Clicks: 1**. Highlight **Project name**, then click and type a fake marker in the input. Expect normal input behavior and no typed value in the tooltip/list. Unresponsive controls, intercepted clicks, or leaked values fail.
4. Highlight Primary target, then scroll a little, resize the window and side panel, and change Chrome zoom to 125% and back. Expect aligned decoration or safe removal when clipped or unplaceable. Click **Move target** while the primary target is highlighted; expect the outline to follow. Highlight **Nested target** and scroll inside its box; expect alignment followed by removal when clipped. Drifting outlines fail.
5. In separate fresh runs, highlight Primary target then click **Hide target**, **Remove target**, or **Cover target**. Expect immediate removal and an honest panel status. Also scroll the target fully offscreen; it must disappear instead of staying at stale coordinates.
6. In separate fresh runs, highlight a target and press **Stop**, click **Change route (SPA)**, click **Next page**, switch tabs, or close the side panel. Expect all old decoration to disappear; Stop clears the list, navigation/tab changes show a fresh-inspection state, and reopening the panel requires inspection again. Reinspect after a full reload and repeat panel-close cleanup. Stale outlines or console errors fail.
7. Leave an inspected/highlighted fixture idle for over one minute. Expect the overlay/list to expire with a reinspection message. Click **Inspect this page** to start fresh. Check the extraction fixture at `http://127.0.0.1:4173` using the earlier milestone 2 privacy steps as well. If using Brave, repeat these checks after reloading the same build on `brave://extensions`.

These milestone 3 steps remain available for regression checks. The user subsequently verified milestone 3 and explicitly authorized milestone 4; see its current verification section below.

## Milestone 3 approval and Git authorization

The user confirmed: “Milestone 3 manually verified in Chrome. The correct target is highlighted, geometry remains aligned, clicks pass through, invalid targets are cleared, and cleanup works.” The user also explicitly requested pushing the changes to the `milestone-3` branch. Milestone 3 is VERIFIED and was committed locally as `fed9c64`. Automatic approval review rejected its push because destination ownership/exact-upload authorization could not be established; the agent reported this and did not bypass it. Milestone 4 was separately approved afterward. Milestone 3's Git permission does not authorize a milestone 4 commit or push.

## User verification for milestone 4

Status: AWAITING USER VERIFICATION. Reload the fixture between destructive cases. Lists expire after one minute; Retry observes again.

1. Run `corepack pnpm build`, reload ClickPilot at `chrome://extensions`, and refresh the fixture tab. Start `python3 -m http.server 4173 --directory tests/fixtures` if needed, then open `http://127.0.0.1:4173/guidance.html`. Click the ClickPilot toolbar icon **on that tab**. Expect **Mock guidance** selected and **Mock mode · Local only** visible. If the panel is blank or cannot inspect, check the extension card's **Errors**, service-worker console, panel console, and page console.
2. Enter **find primary target** and choose **Start mock guidance**. Expect the primary target outlined, an arrow/tooltip, and “Waiting for you to act.” The fixture must remain at **Clicks: 0**, with no automatic scroll, typing, navigation, or click. Click the target yourself, including its text. Expect **Clicks: 1**, overlay removal, and **Click observed** with an explicit statement that the task has not been verified complete. Any automatic action or false completion claim fails.
3. Submit **find settings**. Expect clarification between two matching controls and no overlay. Submit **find navigation settings**, then **find dialog settings** in separate runs. Expect the corresponding exact controls, with no guessed target. Submit **delete my account**; expect an unsupported-task message. Wrong targets or fabricated guidance fail.
4. Reload the fixture and click **Remove primary target**, then submit **find primary target**. Expect a missing-control limitation and no overlay. Reload again, start guidance, then click **Cover primary target**. Expect decoration removed and a paused/unavailable message. Click Retry with the cover still present; expect bounded failure, never an endless loop.
5. Open **Mock test scenarios**, choose **Delay selection by 2 seconds**, and submit **find primary target**. While selecting, press **Stop**. Wait at least three seconds: expect the stopped state and no late overlay. Press **Retry**: it repeats the delayed task and should eventually highlight. In a separate run, submit a delayed task, then choose **Normal** and submit **find profile** before it finishes. Expect only Profile highlighted, including after the old delay has elapsed. A stale overlay or status replacing the newer task fails.
6. Choose **Stale target once, then recover** and submit **find primary target**. Expect one fresh observation followed by a valid highlight. Choose **Stale target on both attempts** and submit again. Expect a pause after one refresh with no overlay. Choose **Invalid mock output** and submit: expect a clear error and no overlay. To recover, choose **Normal** and submit again. Retry retains the previous scenario.
7. In separate runs, navigate with **Next page**, click **Change route (SPA)**, switch tabs, close the panel, or switch to **Manual highlights** while selecting/waiting. Expect cancellation and old decoration removed. Return to the fixture, reactivate if needed, and start fresh. Closing/reopening does not resume old guidance. Stale decoration or console errors fail.
8. Open `http://127.0.0.1:4173/overlay.html`, activate the toolbar, and submit **find primary target** in Mock guidance. Expect refusal because it is not the guidance fixture. Choose **Manual highlights**, inspect, and select Primary target to confirm the milestone 3 debug flow remains available. The mock must not silently run on arbitrary websites.
9. Inspect Network and page/worker/panel consoles during the fixture flow. Expect no backend/model requests, screenshot capture, sensitive value logging, or unexpected errors. If desired, use the page console on this synthetic fixture to call `document.getElementById('primary').click()` while waiting: its fixture handler may run, but ClickPilot must keep waiting because this is a synthetic event. A real user click must acknowledge. Repeat the normal flow in Brave if used; report its result separately.

Report any failed step and exact visible message. Stop at milestone 4 until the user confirms verification and explicitly approves milestone 5A. The implementation request alone did not authorize backend work, commit, push, deployment, or publication; the separate Git authorization below permits the requested branch handoff.

## Milestone 4 Git authorization

The user subsequently requested: “good , now push the relevant code to milestone 4 branch”. This authorizes committing the milestone 4 source, tests, fixtures, and documentation and pushing `milestone-4` to the configured `origin` (`https://github.com/anantjain-afk/ClickPilot.git`). Manual Chrome verification remains AWAITING USER VERIFICATION; no specific manual result is inferred from “good”. The implementation has not changed since the recorded successful checks; this handoff only adds Git authorization documentation. No merge, deployment, or next milestone is authorized.

Milestone 4 was committed locally as `2aae29c`. Its push was rejected by automatic approval review because the remote destination was not explicitly authorized and ownership remained unverified. The agent reported the block and did not bypass it. The later milestone 5A implementation request does not authorize retrying that push.

## User verification for milestone 5A

Status: VERIFIED by the user on 22 October 2026. These steps are retained for regression checks. Full setup/contract reference: `docs/local-api.md`.

1. Run `corepack pnpm dev:api` from the project root. Expect the local Worker to remain running at `127.0.0.1:8787` without a login/key/deployment step. In another terminal run `corepack pnpm verify:api`; expect six PASS lines with the statuses above. Connection failures, wrong status codes, or a 200/model selection for the valid request fail verification. Check the Worker terminal for errors.
2. Run the documented curl command in `docs/local-api.md` using `apps/api/tests/fixtures/valid-request.json`. Expect HTTP 503, JSON `kind: error`, code `provider_unavailable`, and no purported model result. Inspect headers for `Cache-Control: no-store`. The API must not request a key or call Gemini.
3. Use the verification script's malformed, oversized, forbidden-field, excessive-label, and sensitive-goal cases. Expect static bounded errors with no echo of fake marker values, raw schema details, stack traces, or provider exceptions. Inspect the local Worker terminal; bodies and fake secrets must be absent from logs.
4. Run `corepack pnpm build`, reload ClickPilot at `chrome://extensions`, serve fixtures with `python3 -m http.server 4173 --directory tests/fixtures`, and open `http://127.0.0.1:4173/guidance.html`. Activate the toolbar and submit **find primary target** in **Mock guidance**. Expect the same highlight/waiting behavior and no automatic click; click yourself for acknowledgement. Inspect Network: there must be no request to port 8787 or a model service from the extension. New host permissions or backend calls fail this milestone.
5. Check page, panel, and service-worker consoles for unexpected errors. Stop the API server with Ctrl+C, then repeat the mock task in Chrome; it must still work independently. Record the actual results and any failed step. Brave remains optional and separately recorded.

The user subsequently confirmed milestone 5A verification and authorized its branch handoff below. Stop here until explicit milestone 5B approval. No credentials, real model calls, merge, deployment, or publication are authorized.

## Milestone 5A verification and Git authorization

On 22 October 2026 the user stated: “ok , great 5A verification is done , push it in milestone-5A”. Milestone 5A is VERIFIED. This authorizes committing its relevant API/shared source, tests, fixtures, tooling, lockfile, and documentation and pushing `milestone-5A` to the configured origin (`https://github.com/anantjain-afk/ClickPilot.git`). No implementation changed after the recorded passing checks; this handoff only updates verification/authorization documentation. Milestone 5B remains NOT APPROVED.

## Milestone 5B plan revision — 22 October 2026

Status: REVISED PLAN — AWAITING USER APPROVAL. The user requested conversational assistance alongside visual guidance and explicitly prohibited coding before revised-plan approval.

- Updated only `PLAN.md` and this record. No schemas, implementation, dependencies, permissions, provider configuration, secrets, commits, pushes or deployments were changed/performed for this revision.
- Proposed three outcome categories using four strict literals: `guidance` (panel message + observed target + tooltip), `answer` (panel text), and `clarification` / `unsupported` (question or honest explanation). Panel messages are bounded to 600 characters; tooltip instructions to 160. Only guidance accepts a target; every model string renders literally.
- Documented a proposed protocol 2 migration, `AssistantResultSchema`, removal of model `complete` / `expectedOutcome` fields, and the scoped shared/API/session/panel/routing/config/test/documentation changes. Current protocol 1 code stays unchanged until approval. An answer never implies verified completion.
- Preserved standalone single-step requests, no history/memory/planning/autonomous actions, no automatic follow-up after clicks, privacy/minimization, dual-boundary Zod validation, identity guards, Stop/Retry/cancellation, one-refresh recovery and safe errors/kill switch. Added tests/manual steps for text-only as well as visual outcomes.
- Validation: documentation diff/consistency checks only. Runtime tests, builds and Gemini calls were not rerun because no implementation changed. Prior evidence does not imply that the proposed 5B contract is implemented.

Stop here. Await explicit approval of the revised milestone 5B plan before implementation.


## Milestone 5B implementation — 22 October 2026

Status: **VERIFIED**. The user explicitly approved the revised plan, implementation and checks, then configured the ignored backend secret locally. After implementation, the user confirmed manual verification and authorized the relevant commit/push to `milestone-5B`. Earlier planning-only gates above record their historical state; this approval superseded them for 5B only. No deployment or milestone 6A is authorized.

### What changed and why

- `packages/shared/src/guidance.ts` now defines protocol **2** and strict `AssistantResultSchema`: guidance (panel message + observed target + tooltip), answer, clarification and unsupported. Messages are trimmed/nonempty and bounded to 600 characters; instructions to 160. Old outcomes/protocol, extra fields, executable plans/selectors and target fields on text-only outcomes are rejected. An answer never means task completion.
- `apps/api/src/gemini.ts` adds one direct REST `generateContent` call per independent request, backend-only key/model configuration, supported JSON schema, 20-second timeout, abort propagation and safe provider/quota/invalid-output errors. `app.ts` applies Zod, privacy checks and eligible-target membership before returning server-supplied identity. No provider SDK/framework or new third-party library was added. The existing Zod version is now a direct backend dependency for validating Google's response envelope; the extension links the existing shared workspace package.
- Privacy filtering runs **before extension upload and again on the backend**. The client sends only the current question, origin, eligible labels/control inventory and envelope IDs. Protocol 2 drops geometry/viewport from HTTP requests. Gemini receives no envelope IDs, paths, query/hash, field values, prior turns or screenshots. Filtering still has the documented heuristic limitations.
- `src/lib/assistant.ts`, background routing and a small `GET_SNAPSHOT` content message reuse the current registry and active-tab/document checks. The fixed client endpoint is exactly `http://127.0.0.1:8787/v1/guidance/next`. The explained loopback host permission was added; an explicit tab/origin toolbar grant prevents that host grant from silently activating DOM inspection. Worker restart requires another toolbar click; no storage permission/persistent background session was introduced.
- `session.ts` shares existing observation/highlight/cancellation logic between Mock and Assistant. One focused hook reuses existing panel connections/events instead of duplicating their lifecycle code. A valid but unavailable target permits one refresh; invalid/invented IDs are rejected. Guidance text appears only after live target acceptance. Text-only replies do not render overlays and remain snapshot-bound for invalidation. Stop, replacement, navigation, tab change, expiry, disconnection and panel closure reject stale text and guidance alike. Clicks only acknowledge an unverified action; they never start another request.
- `AssistantPanel.tsx` adds the current question/reply, a bounded input, disclosure/consent and Stop/Retry while preserving labelled Mock and Manual modes. Model strings use ordinary React text children; existing tooltips use `textContent`. No history, Markdown/HTML renderer, automatic actions or arbitrary page-prose extraction was added.
- Updated setup/contracts/manual steps in `docs/local-api.md`, README and PLAN. `apps/api/.dev.vars` is Git-ignored; its key was never printed or copied into source/client bundles.

### Actual automated evidence

All final checks below completed with exit **0**:

| Exact command/check | Result | Provider boundary |
|---|---|---|
| `CI=true corepack pnpm install --ignore-scripts --no-frozen-lockfile` | Workspace links/lockfile updated; existing packages restored | No provider calls |
| `corepack pnpm typecheck` | Shared, API and extension strict TypeScript passed | No provider calls |
| `corepack pnpm lint` | ESLint passed | No provider calls |
| `corepack pnpm test` | **55 API tests + 37 extension unit tests passed** | Injected/mock fetch/provider replies only |
| `corepack pnpm build` | Extension production bundle + Worker `wrangler deploy --dry-run` passed; also repeated within final e2e command | No deployment or Gemini calls |
| `corepack pnpm test:e2e` | **55 Chromium tests passed (55.0 seconds)** | 20 Assistant cases use a test-only HTTP mock at port 8787; remaining cases cover Mock/Manual/observer/overlay regressions and toolbar activation |
| `corepack pnpm verify:api` | **Five real local Worker HTTP checks passed:** malformed JSON 400, oversized body 413, forbidden field 400, excessive label 400, sensitive goal 422 | Actual runnable Worker; all fail before Gemini |
| `corepack pnpm --filter @clickpilot/api smoke:gemini` | **Four REAL GEMINI cases passed** with configured `gemini-3.5-flash-lite`: guidance/observed target, answer, clarification and unsupported | Actual local Worker → Google API; synthetic controls/questions only; protocol/identity/result/target validation applied |
| `git diff --check` | Passed | No provider calls |
| Python inspection of production manifest/client files | Exact `activeTab`, `scripting`, `sidePanel` permission set; one loopback host; no static content scripts; fixed endpoint present; actual configured key, `GEMINI_API_KEY` and Google provider endpoint absent from client bundle | Only boolean/pass status printed; no secrets printed |

Provider tests cover strict variants, legacy/extra/blank/oversized output, target filtering, malformed/blocked/truncated envelopes, byte bounds, missing config, kill switch, network failures, rate limits, timeout and cancellation. Session/browser tests cover text-only and guidance outcomes, safe literal hostile text, fresh independent payloads, one target refresh, trusted click acknowledgement, replacement/Stop/navigation/tab/panel-close races and recovery to Mock. No browser test contacts Gemini. The real smoke cases are four synthetic outcomes, **not** an accuracy benchmark or end-to-end manual Chrome approval.

### Issues encountered and resolved

- Offline installation could not access the existing package cache; the normal approved install restored existing packages. Initial checks failed until the shared link and direct use of the existing Zod package were installed. No new SDK/dependency family was introduced.
- Zod's discriminated union emits `oneOf`; the provider schema uses a plain union of the same four strict schemas to emit supported `anyOf`, while runtime validation retains the discriminated union. The initial schema-shape test failure was fixed and all 55 API tests pass.
- The first local Worker smoke returned a safe 502. A separate synthetic direct Google diagnostic confirmed key/model access. The Worker required `redirect: 'manual'` rather than browser-style `error`; non-2xx redirects are rejected without forwarding the key. Cloudflare's `enable_request_signal` flag was also enabled for disconnect cancellation. Four actual Worker-to-Gemini outcome calls then passed. Temporary diagnostics printed only fixed categories/statuses and were removed.
- The first browser run passed 54 cases. Adding the activation guard exposed a harness startup race: CDP could trigger the action before the background listener registered. The helper now waits for `onClicked.hasListeners()`. The failing run was interrupted, three focused activation/assistant tests passed, and the final **55-case** full run passed. A final small serialization cleanup passes only explicit session/request IDs through the internal assistant boundary; unit/type/lint/build checks and the complete 55-case browser suite were rerun successfully afterward. These intermediate failures are not counted as successful checks.
- Impeccable detector attempt exited 127 because engine 0.1.5 was unavailable in its permitted cache; no automated design-detector pass is claimed. An independent fresh-context visual reviewer inspected valid 360px, 260px and fixture/overlay captures and returned **ship** for the narrow addition, with no material fixes. The documenter confirmed incumbent colors/type/components were preserved and no new design documents/system changes were needed. Captures use mocked API output only and remain temporary artifacts under `/tmp/clickpilot-5b-*.png`.

### Exact manual Chrome verification

1. Keep your key/model in ignored `apps/api/.dev.vars` and `GUIDANCE_ENABLED=true`. From the repository root start `corepack pnpm dev:api` in one terminal; if the fixture is not already served, start `python3 -m http.server 4173 --directory tests/fixtures` in another. The production build is already prepared. At `chrome://extensions`, enable Developer mode and load/reload `apps/extension/.output/chrome-mv3`. Open `http://127.0.0.1:4173/guidance.html`, click ClickPilot's toolbar icon and select **AI assistant**. Before checking **Allow this panel…**, Ask must be disabled. Without toolbar activation, inspection must request activation.
2. Read the disclosure and check consent. Ask **“Show me the Primary target button.”** Expect a short panel explanation, a correct highlight/arrow and a separate short tooltip, with **Clicks: 0** until you click. Scroll/resize to check alignment/invalidation and click-through. Click the target yourself: expect an explicitly unverified acknowledgement, cleanup and no automatic follow-up request.
3. Ask **“Explain what a navigation menu is in general; no highlight needed.”** Expect a short useful answer and no old/new overlay. Ask **“Find Settings.”** Expect clarification between duplicate controls. Ask **“Tell me my account balance from this page.”** Expect an honest limitation. Resubmit **“Find Settings in Main navigation.”** as a fresh question; no prior question should be sent. Wording varies with Gemini; never accept invented page facts or completion claims.
4. Using only fake data, inspect the extension service-worker DevTools Network request to port 8787. Expect protocol 2, current task, origin, IDs and eligible control labels; no path/query/hash, input values, geometry/viewport, screenshot, history or key. Inspecting synthetic upstream shapes is covered by unit tests. Hostile HTML/Markdown strings must stay literal; the deterministic browser tests verify no markup execution.
5. Submit and immediately Stop/replace, use **Change route (SPA)**, switch tabs or close the actual side panel. Repeat for text requests and visual guidance. Expect no late reply/highlight and displayed text cleared after page changes. Unchecking consent must stop work. Cover/remove a target to check cleanup or one bounded refresh. Reload the fixture and click the toolbar again to recover.
6. Stop the backend and ask: expect a connection error. Restart and Retry. Set `GUIDANCE_ENABLED=false` and restart: expect service disabled, never a fake answer; restore `true` afterward. Switch to **Mock guidance** with the backend stopped: the fixture tasks must still work. Timeout, quota, malformed output and delayed-response failures are tested deterministically; there is no need to exhaust real quota. Any stale reply, guessed target, unsafe text, blocked interaction, unexpected upload or automatic action is a verification failure.

### Remaining limitations and stop gate

- The user confirmed manual verification of milestone 5B. Headless tests separately opened panel HTML in a tab. No additional Brave or varied third-party-page coverage is inferred from that confirmation.
- Only observed controls/context are available, not arbitrary page prose, field values, account state or screenshots. No conversation memory or multi-step verification exists. Privacy filtering is heuristic; only non-sensitive public/synthetic data should be used.
- Local endpoint only. Google project quota/data policy applies; no free quota, durable spend limit or hosted authentication/abuse control is claimed. Already-accepted provider work can consume quota despite cancellation. Hosted operation needs separately approved controls.
- The API test server is stopped after checks. The pre-existing fixture server at port 4173 remains available; it was reused without stopping another session's process.

**STOP:** Milestone 5B is user-verified. Its branch commit/push is authorized below; do not begin milestone 6A, deploy or publish without explicit permission.


## Milestone 5B verification and branch handoff — 22 October 2026

The user stated: “great , it everything looks fine , i have manually verified , push the code to milestone-5B”. Milestone 5B is **VERIFIED**. This explicitly authorizes committing its relevant extension/API/shared implementation, tests, fixtures, dependency links/lockfile and documentation, then pushing branch `milestone-5B` to the configured origin, `https://github.com/anantjain-afk/ClickPilot.git`.

This handoff updates verification/authorization documentation only; runtime implementation is unchanged from the recorded passing checks. The previous automated and real Gemini evidence remains applicable and was not rerun solely for this documentation update. Check the final diff and exclude ignored backend secrets, local variables, generated builds and temporary captures from the commit. No deployment, publication or milestone 6A is authorized.

## Milestone 6A plan revision — 22 October 2026

Status: **AWAITING USER VERIFICATION** of the revised plan. Implementation is **NOT APPROVED**. The user requested this plan revision before implementation.

- Updated only `PLAN.md` and this progress record. Replaced mandatory per-step expected outcomes with Gemini next-step reasoning, deterministic content-script observation and controller-owned wait/retry/next-request decisions. Small structured checks are optional; unverified progress, verified step outcomes and user confirmation remain distinct.
- Made temporary in-memory task context explicit: original goal, current step number, last attempted action and observed verification status. Every subsequent request includes the original goal, a fresh sanitized snapshot and only bounded previous-step context. Proposed strict protocol 3 schemas, privacy checks at both boundaries and disclosure updates are implementation work pending approval.
- Specified context replacement/cleanup, one in-flight request, bounded refresh/step/no-progress handling and session/request/tab/document/snapshot/attempt guards. Stop and termination clear context; late work cannot restore it. No history, persistent memory, database, LangGraph, new dependency or permission is planned. Lifecycle recovery/checkpoints remain 6B.
- Added deterministic acceptance coverage and numbered future Chrome checks, including preservation of a synthetic Vercel-domain goal, optional outcomes, no-change recovery, request privacy, Stop and stale replies. These are planned tests, not executed behavior.
- Actual validation: `git diff --check` — exit 0. Reviewed `git diff --stat` and `git diff -- PLAN.md PROGRESS.md` for scope and consistency; only these two documentation files changed. Typecheck, lint, unit/browser tests, builds and Gemini calls were not run for this documentation-only revision. No runtime verification is claimed; Chrome checks apply after approved implementation.

Stop here for review and explicit approval of the revised 6A plan, as required by `AGENTS.md` milestone workflow steps 2 and 8. No 6A code, commit, push, deployment or next milestone was performed.


## Milestone 6A implementation authorization — 22 October 2026

The user requested a minimal `nextStep: "none" | "after_user_action"` signal and instructed: “Update the plan first and start implementing 6A”. The plan was updated before code changes. This explicitly approves 6A implementation, including temporary bounded task context, deterministic observation, optional outcome checks and continuation control. Earlier NOT APPROVED entries are historical. No 6B, commit, push, deployment or publication is authorized. Implementation/check evidence will be recorded below.


## Milestone 6A implementation — 22 October 2026

Status: **AWAITING USER VERIFICATION**. The user authorized the final plan update and implementation, including the minimal continuation signal. Earlier planning-only NOT APPROVED entries above record historical gates. No 6B, commit, push, deployment or publication is authorized.

### What changed and why

- Protocol **3** requires `nextStep: "none" | "after_user_action"` on guidance only. Gemini chooses from the original goal, fresh sanitized controls and bounded previous-step context. Final guidance makes no automatic follow-up even after an observed page change; text-only responses pause. The signal is not a completion claim. Missing/invalid signals, text-only continuation fields, arbitrary conditions and old protocols are rejected by strict shared/API/extension validation.
- The side-panel session owns the original goal, step number and one previous action/event/verification status in memory. Each later request retains that goal and sends fresh filtered controls plus only the immediately previous bounded record. Client and backend privacy filters check previous-action text. No full history, persistent memory, database, LangGraph, dependency or browser permission was added.
- The content script observes only a trusted click within the highlighted target, clears its overlay, then takes one permitted control/state observation after two seconds. It reports meaningful control/expanded-state change and optional `target_hidden` / `target_expanded` check results. An expanded check requires a transition to true, not an already-expanded target. No input values, arbitrary prose, screenshots or selectors are read/sent as verification.
- The session controller requests another step only for continuing guidance after a relevant changed observation without a failed check. Unchecked progress remains unverified. No change, failed checks or missing observations offer recovery. Retry keeps the same goal/step; Continue manually records `user_confirmed`. Confirm task complete explicitly credits the user's confirmation. Step checks never establish overall task success.
- One request at a time, one automatic target refresh per step, a 20-step ceiling, repeated-guidance detection, a 3.5-second observation timeout and existing abort/identity/live-target guards bound work. Late observations and replies cannot revive terminated tasks. Stop, replacement, consent withdrawal, navigation, tab change, panel closure and disconnection cancel work and clear active context. Full navigation/restart pauses or ends safely; resumable recovery remains 6B.
- Background reinspection now reuses the live observer and injects only when absent. WXT reinjection invalidates the prior context, so reinjecting on every step had changed its document token despite staying on the same page. Reuse preserves document identity while still creating fresh snapshot IDs and checking actual active-tab URL/access. No second background coordinator was introduced.
- Updated the existing panel copy, disclosure, step/status display, recovery/confirmation controls and badge. Action buttons wrap at narrow widths. Added a synthetic Settings → Domains → Edit domain fixture, focused session/API/browser tests, and protocol/setup/Chrome instructions in `docs/local-api.md` and README.

### Actual automated evidence

| Exact command/check | Result | Boundary |
|---|---|---|
| `corepack pnpm typecheck` | Exit 0; shared/API/extension strict TypeScript passed | No provider calls |
| `corepack pnpm lint` | Exit 0 | No provider calls |
| `corepack pnpm test` | Exit 0; **61 API tests + 54 extension unit tests passed** | Mock provider/fetch only |
| `corepack pnpm build` (run by `test:e2e`) | Exit 0; MV3 production build and Worker dry-run bundle passed | No deployment/provider calls |
| `corepack pnpm test:e2e` | Exit 0; **69 Chromium tests passed (1.8 minutes)** | Local fixture + mock HTTP API only; no Gemini |
| `git diff --check` | Exit 0 | Source/documentation whitespace check |
| Python production manifest/client inspection | Exit 0; exactly `activeTab`, `scripting`, `sidePanel`, one loopback host, no static content scripts; Google endpoint/key configuration/key pattern absent from client JS | Boolean/pass output only |

Coverage includes both continuation signals, missing signals, optional check success/failure, mixed checked/unchecked three-step guidance, original-goal retention, fresh snapshots, bounded previous context, private-marker omission, Retry/manual confirmation, step ceiling/no-progress pause, synthetic/unrelated clicks, observation timeout, stale/duplicate observations, Stop/replacement/navigation/tab/consent/panel cleanup and the existing Mock/Manual/overlay regressions. Headless tests open panel HTML in a tab; actual Chrome side-panel behavior still requires user verification.

Visual QA: inspected final synthetic 360px and 260px panel captures at `/tmp/clickpilot-6a-360.png` and `/tmp/clickpilot-6a-260.png`. The existing cream/green design, readable states and wrapped actions are preserved; browser assertions confirm no horizontal overflow. These screenshots use mock output. The Impeccable context launcher exited 127 because its engine/cache was unavailable; existing code supplied context. No detector pass or independent reviewer is claimed.

Intermediate failures: the first typecheck failed because existing fixture/test contexts had not yet migrated; migration resolved it. The first browser command was blocked by sandbox local-server binding and was rerun with approved escalation. The first executable suite passed 54 cases, failed three (document-token changes during reinspection), and skipped ten serial cases. Observer reuse fixed that issue; the next full run passed 67 cases. Two additional check cases and final UI/guard adjustments were then verified in the final suite above. Intermediate failures are not counted as successful evidence.

### Manual Chrome verification required

1. From the project root, run `corepack pnpm dev:api` with the existing ignored backend configuration. Separately run `python3 -m http.server 4173 --directory tests/fixtures`. At `chrome://extensions`, reload `apps/extension/.output/chrome-mv3`. Open `http://127.0.0.1:4173/multistep.html`, click the toolbar, choose **AI assistant**, read the disclosure and consent. Expect Ask disabled before consent and no spontaneous webpage action.
2. Ask **“Change a Vercel domain. Guide me to Edit domain in this synthetic fixture.”** Expect a single grounded Settings suggestion, then click Settings yourself. Expect a fresh Domains suggestion toward the same goal; click Domains and expect Edit domain. Click only when you choose. A changing goal, guessed/stale target, unsolicited action or repeated automatic request without a relevant click is a failure. Model wording/optional checks vary; deterministic tests cover exact branches.
3. Inspect fake-data requests to `127.0.0.1:8787` in extension-worker DevTools. Expect protocol 3, the same original goal, new snapshot IDs, increasing step numbers and only one bounded previous action/status. First previous-step context must be null. Older replies/snapshots/history, private URL components, input values, screenshots and keys must be absent. Do not share real credential captures.
4. For a one-step task, reload/activate and ask **“Only show me Settings; no follow-up.”** Expect final guidance with `nextStep: "none"`; clicking Settings must not issue another model request or claim overall success, even if a step outcome was objectively checked. Ask a general text question: expect no overlay or automatic continuation. **Confirm task complete** must explicitly say completion was confirmed by you.
5. Ask **“Guide me to Do nothing, then decide the next action after I click.”** When the result uses `after_user_action`, click Do nothing. Expect recovery after the observation window with no request loop. Retry must retain the original goal and current step; Continue manually must send `user_confirmed`, never `verified`. No-check page changes can continue but must show the previous step as unverified. Optional-check and model-branch specifics are also covered reproducibly by browser tests.
6. During observation and while a reply is pending, separately test Stop, replacement, consent withdrawal, tab switching, navigation and actual panel closure. Expect removed overlays and no late reply/follow-up. Restarting a task must use step 1/null previous context. Navigation/restart requires a fresh task rather than replaying old targets. Check page/panel/worker consoles for unexpected errors. Repeat Mock/Manual smoke checks to confirm they remain local and unchanged in purpose.

### Remaining limits and stop gate

- No real Gemini calls or real-account/domain modifications were made for 6A. All new automated reasoning responses are mocked; no live model/schema availability or accuracy benchmark is claimed. Real model continuation decisions and actual Chrome side-panel lifecycle remain manual verification work.
- Observation compares eligible control roles/names/context and target expanded state at a fixed two-second point. Arbitrary prose/value changes and transient or slower transitions may be missed and require manual recovery. A hidden check means detached/offscreen/visually unavailable, not proof of a business action.
- DOM-only, one tab, bounded task and previous-action text, existing one-minute snapshot lifetime. Stop/termination loses the task; no conversation-history clarification, cross-navigation continuation, checkpoints or restart resume was added. Privacy filtering retains its documented heuristic limits.
- Browser fixture/mock servers are managed by Playwright and close after the suite. No production resources were changed. Build output is ready for unpacked loading.

**STOP:** Await the user's Chrome verification. Fix only 6A if a check fails. Do not begin 6B, commit, push, deploy or publish without separate explicit permission.

## Milestone 6A Chrome verification bug fix — 22 October 2026

Status: **AWAITING USER VERIFICATION**. The user reported that clicking Settings in the real Gemini flow exposed Domains but produced `invalid_provider_response`. This is a 6A correction only; no 6B work, commit, push or deployment was done.

The protocol 3 continuation request preserved the original goal and sent step 2, the previous Settings action/status, a new snapshot and fresh eligible IDs including Domains. The failure was earlier than target membership or extension validation. Synthetic live Gemini calls with the generated Zod JSON Schema returned HTTP 200 but `MAX_TOKENS` and unfinished JSON inside `message`; the adapter correctly rejected the non-`STOP` envelope. The generated schema contained `const`, `pattern`, `minLength`, `maxLength` and `$schema`, which are outside Gemini's documented supported JSON Schema subset. Merely increasing the token budget or removing length keywords did not fix the truncation. A minimal schema using supported keywords and explicit required fields produced complete guidance in repeated synthetic second-step calls; the strict `AssistantResultSchema`, sensitive-text checks, inventory membership, protocol envelope and live-target checks remain unchanged.

The API now sends that provider-facing schema and exposes optional local `GUIDANCE_DIAGNOSTICS=true` logging. Diagnostics contain only fixed failure stages and allowlisted Zod paths/codes, never raw page/model values. A regression test models first-step Settings success followed by a second-step Domains request and makes unsupported schema keywords reproduce the former `MAX_TOKENS` failure. Separate tests check truncated-output diagnostics and fail-closed schema/target rejection.

| Check | Result |
|---|---|
| Synthetic live Gemini adapter calls with the corrected schema | First and second calls: HTTP 200, `STOP`, complete JSON, required `nextStep`, valid target membership and protocol 3 envelope; no page/model text printed |
| Synthetic two-step calls through the already-running local Worker | Both HTTP 200 protocol 3; step 1 selected Settings and step 2 selected Domains, with original goal retained, fresh snapshot/ID inventory, bounded previous context, `nextStep`, and matching request/snapshot IDs; no page/model text printed |
| `corepack pnpm typecheck` | Exit 0; shared/API/extension |
| `corepack pnpm lint` | Exit 0 |
| `corepack pnpm test` | Exit 0; **64 API + 54 extension unit tests passed** |
| `git diff --check` | Exit 0 |
| `corepack pnpm build` | Exit 0; extension build and Worker dry-run bundle; Wrangler emitted a sandbox-denied log-file warning, but completed the dry run |
| `corepack pnpm exec playwright test` | First attempt could not bind the local fixture server in the sandbox. Escalated run: 35 passed, 1 failed, 33 skipped because the user's existing local Worker occupies 127.0.0.1:8787, which the mock API suite also binds. The existing Worker was left running; the prior 6A full suite had passed 69/69 before this backend-only fix. |

Manual Chrome verification: restart the local Worker so it loads the changed API code, rebuild/reload the unpacked extension if needed, and repeat Settings → Domains → Edit domain on `http://127.0.0.1:4173/multistep.html`. Check that each suggestion highlights the currently visible control, only user clicks advance, and the original goal remains in the step 2 request. The full numbered 6A checks above remain applicable. If a failure recurs, enable the optional diagnostics and inspect only stage/path/code in the local Worker console. Stop after user verification; do not proceed to 6B.

## Shared highlighting correction — 23 October 2026

Status: **VERIFIED by the user on 23 October 2026**. The user explicitly approved the investigated fix, requested asymmetric-radius support and genuine partial-occlusion checks, and subsequently confirmed: “i have verified everything”. They reported successful identification of the visible buttons and authorized committing and pushing these changes to `milestone-6A`. This is a scoped correction before 6B; no 6B work, deployment or publication is authorized.

### Confirmed cause and implementation

- The live Excalidraw Hand button had a 36×36px box and an 8px border radius. Its center correctly hit a nested SVG path. The old bottom-right probe, 2px from the bounding-box edges, fell outside the rounded clickable shape and hit a toolbar ancestor instead. `targetRect` rejected that hit before creating an overlay. The button was connected, visible, enabled, in view and untransformed. The point's `elementsFromPoint` stack did not contain the button; it was outside the button's shape rather than underneath a covering control.
- Both Manual Highlights and AI guidance use `HIGHLIGHT_ELEMENT` → `SHOW_OVERLAY` → `showOverlay`. The existing production build returned `OVERLAY_RESULT { ok: false }` for both message variants during investigation. The registry/selection was valid; retrying inspection could not correct the corner geometry.
- Added `src/features/overlay/hit-test-points.ts` alongside the existing renderer. It resolves all four CSS corner radii independently, including px/percentages, elliptical radii and CSS overlap normalization, then maps them into the current viewport box. It samples just inside each corner's ellipse and keeps the center plus four probes near the straight edges. Every probe must hit the target or its descendants; unrelated hits, including ancestors, still reject. It does not accept a covered target merely because some other sample is usable.
- The renderer retains live per-draw connectivity, visibility, disabled-state, viewport, identity and positioning checks. Nested SVG descendants remain valid. Tests also verify a nested shadow icon, rejection of an unrelated shadow cover, positive axis scaling, conservative rejection of a rotated fixture, and loss of pointer interaction. No shadow-tree extraction support was added. Overlay isolation, pointer transparency, text-only instructions, cancellation and snapshot-scoped cleanup remain in place.
- Added development-only diagnostics in `src/features/overlay/diagnostics.ts`, called by the renderer and content-script registry check. They contain fixed failure/probe codes only: no element objects, labels, text, values, URLs, selectors, instructions or identity tokens. A failed attempt/draw stops after logging once. Production builds omit the diagnostic logger.
- Replaced the exhausted-refresh message and related shared inspection/tab/navigation messages with wording appropriate to websites. The exhausted-refresh message now asks the user to make the control visible and unobstructed before Retry. Fixture-specific selection text remains confined to Mock mode.
- Added `tests/fixtures/targets.html`, geometry/diagnostic unit tests, and Manual/AI browser regressions for rounded/asymmetric/elliptical/overlapping/one-large-corner/pill/square buttons, nested SVG clicks, full covers, edge/corner covers with an exposed center, detached nodes before/during highlighting, replacement while an AI reply is pending, one-refresh recovery and Stop. The AI test mock now binds an ephemeral local port, with browser-context routing from the unchanged extension endpoint, avoiding the user's already-running Worker on port 8787. No dependency, permission, backend behavior or extension endpoint changed.

### Actual verification evidence

| Exact command/check | Result |
|---|---|
| `corepack pnpm typecheck` | Exit 0; shared/API/extension. Final output: `/tmp/clickpilot-highlight-typecheck.log` |
| `corepack pnpm lint` | Exit 0 |
| `corepack pnpm test` | Exit 0; **64 API + 61 extension unit tests passed** |
| `WRANGLER_LOG_PATH=/tmp/clickpilot-highlight-wrangler.log corepack pnpm test:e2e` | Exit 0; extension production build and API Worker **dry-run** build passed, followed by **89/89 Chromium tests passed (2.2 minutes)**. Output: `/tmp/clickpilot-highlight-e2e.log`. No deployment or Gemini calls |
| `corepack pnpm --filter @clickpilot/extension exec wxt build -b chrome --mode development` | Exit 0; standalone diagnostic build at `apps/extension/.output/chrome-mv3-dev`; production output remains at `apps/extension/.output/chrome-mv3` |
| Python production manifest/client inspection | Passed: exactly `activeTab`, `scripting`, `sidePanel`; unchanged loopback host; no static content scripts; highlight diagnostic logger and provider secret configuration/endpoint absent from production client JS |
| Python production/development comparison | Passed: diagnostic console marker absent in production, present in development |
| Isolated Chromium development-build smoke on the local fixture | Exit 0; an edge cover reports only `{ reason: 'hit_test_failed', probe: 'top_edge' }`; a corner cover reports only the corresponding `top_left` code. Exactly one diagnostic per failed attempt/invalidation, including subsequent frames |
| Isolated Chromium production-build smoke on live Excalidraw | Exit 0; actual Manual UI highlights Hand, outline aligns, overlay survives repeated draws, Manual Stop removes it; shared guidance message returns `ok: true`, remains pointer-transparent and cleans up with its own snapshot. **Zero Gemini requests and zero webpage-control clicks** |
| `git diff --check` | Exit 0 |

The existing fixture server and API Worker were left running. The browser mock server closed after the suite; the original Worker still owned port 8787 afterward. Headless checks open panel HTML in a tab; actual Chrome side-panel layout/lifecycle and live Gemini target selection remain manual verification work.

Intermediate evidence: the first new unit run passed 59 and failed two because a test attempted to copy a CSSStyleDeclaration's read-only indexed properties. Removing that test-setup assignment resolved both failures; no production fix was needed. The initial production build completed but Wrangler could not write its default log outside the sandbox; the final full build used the explicit `/tmp` log path and completed without that warning. The first live post-fix smoke confirmed both highlights but its final cleanup assertion used the Manual panel's old snapshot after a diagnostic independently created a newer snapshot. The old cleanup correctly left the newer overlay intact. The corrected smoke checked Manual Stop before creating the diagnostic snapshot and then cleared the latter with its own identity; all checks passed without changing cleanup protections. An earlier focused browser run also passed all 18 selected tests before the last asymmetric/shadow cases were added; the final 89-test run above includes them.

### Manual Chrome verification — confirmed by the user on 23 October 2026

1. At `chrome://extensions`, reload the unpacked extension from `apps/extension/.output/chrome-mv3`. Open `https://excalidraw.com`, activate ClickPilot using its toolbar icon, select **Manual highlights**, and inspect. Highlight **Hand (panning tool)**. Expect an aligned outline, arrow and tooltip, with the panel waiting for you instead of reporting unavailable. The webpage must not select a tool on its own.
2. Resize the panel/window and change browser zoom while the Hand target remains in view. Expect alignment or conservative removal if the target becomes clipped/unavailable. Click Hand yourself; expect normal tool selection without overlay interception. Press **Stop**; expect no decoration. Misalignment, blocked clicks, unsolicited actions or persistent decoration fail verification.
3. With the usual local API Worker running (or start `corepack pnpm dev:api` if needed), select **AI assistant**, give the existing disclosure/consent, and ask **“How can I select the hand?”**. When Gemini selects Hand, expect the same successful highlight and no exhausted-refresh/fixture message. Click only when you choose. Stop, switch tabs, navigate and close the panel in separate runs; expect cleanup and no late highlight. Real model selection is not claimed by the mocked tests.
4. Use the existing fixture server, or run `python3 -m http.server 4173 --directory tests/fixtures`. Open `http://127.0.0.1:4173/targets.html`, activate ClickPilot, inspect and highlight **Primary target**. Try **Asymmetric ellipses**, **One large corner**, **Overlapping asymmetric radii** and **Pill**. Expect a correctly anchored highlight and normal user clicks. Choose **Rounded** before the cover checks.
5. While Primary target is highlighted, click **Cover top edge** and **Cover rounded corner** in separate runs, uncovering between them. Its center remains exposed, but the overlay must clear. Attempting to highlight while covered must fail; **Uncover target** must allow a highlight again. Repeat a full cover. Click **Replace target node**: old-list highlighting must fail, and **Inspect this page** must recover with the replacement. Repeat Stop and panel-close checks. Any cover accepted at these tested locations, stale decoration or failure to recover fails verification.
6. Optional diagnostics: load `apps/extension/.output/chrome-mv3-dev` instead of the production build, open the page's DevTools console, and repeat an edge/corner cover. Filter for `[ClickPilot highlight]`. Expect only a fixed reason/probe record once for the failure; no DOM objects, labels, page text, values or instructions. Return to the production build afterward. In both builds inspect page, panel and extension-worker consoles for unexpected errors.

### Remaining limits and stop gate

- Hit testing remains a conservative sample of nine positions, not a pixel-by-pixel proof of zero occlusion; a tiny cover between probes may be missed. Edge/corner regression patches deliberately leave the center available and still reject. Arbitrary rotations/skews, unresolved `calc()`/other radius expressions, unusual clipping/corner shapes and heavily transformed layouts may still reject safely. No new support for iframe/canvas/shadow-tree targets is claimed.
- No real Gemini request was made by the agent for this correction. Automated AI-path tests use the isolated mock; the live smoke exercised the shared guidance rendering message without a provider. The user subsequently confirmed completion of the supplied Chrome verification and approved the changes.

**STOP: VERIFIED.** The user authorized committing and pushing this correction to `milestone-6A`. Milestone 6B, deployment and publication remain unapproved. This verification supersedes the earlier pending-verification entries for 6A; it does not change the separate historical verification status of earlier milestones.


## Dynamic popup observation correction — 23 October 2026

Status: **AWAITING USER VERIFICATION**. The user approved the scoped correction, including stable snapshot identities, the 150-control limit, and named settling/timeout constants. No 6B work, commit, push, deployment or publication was performed.

### Implementation and safeguards

- Investigation with the actual extractor in isolated Chromium confirmed missing `menuitemcheckbox`, `menuitemradio` and `option` roles, omission of late portal menus after the first 150 background controls, and a menu appearing after the old fixed two-second sample. Portals and hidden-to-visible controls already worked when eligible and within the cap. The signed-in ChatGPT/YouTube DOM was not inspected; no claim is made that one particular defect explains every live-site instance.
- Extended extraction and the shared strict request schema with those roles. Non-native semantic menu options are eligible; native select options are not independently highlighted. The same contenteditable, sensitive-input, label/value privacy, hidden/inert, geometry and viewport exclusions remain. Disabled controls retain their Manual disabled flag and remain excluded from provider context and actionable change detection.
- Visible popup/menu/listbox/dialog/popover controls receive first access to the existing 150 slots; remaining slots are filled with ordinary controls in document order. There is no separate popup-only inventory. IDs are assigned after ordering, once per snapshot, to exact Element references. Temporary observation collections do not mutate the retained registry. Old snapshot IDs do not silently resolve replacement elements.
- Added `apps/extension/src/features/observer/observe-action.ts`, reusing extraction and `eligibleElements`. It combines coalesced mutation notifications with bounded 100ms resampling for CSS-only changes. Only changes to eligible controls or expanded state reset settling; unrelated prose mutations do not. Running animations affecting eligible controls delay settling. Equivalent re-renders/reordering do not fabricate progress; duplicate control counts remain significant.
- Named shared constants: `OBSERVATION_SETTLE_MS = 400`, `OBSERVATION_MAX_MS = 5000`, `OBSERVATION_TIMEOUT_GRACE_MS = 1500`. The controller waits for the maximum plus grace. The content observer takes a fresh baseline rather than the old inspection inventory; trusted pointer-down/Enter/Space preparation also handles menus opening before click. Preparation alone never advances guidance: a matching trusted click is still required. Prepared baselines expire after the named `ACTION_BASELINE_MAX_AGE_MS = 1500`.
- Each attempt reports once and disconnects its MutationObserver/timers. Stop, replacement, consent withdrawal, page/tab changes, panel closure, snapshot invalidation and context disposal retain existing cancellation and identity guards. Live-target visibility, hit testing, overlay isolation and pointer transparency were not relaxed.
- A settled menu/control change without a declared outcome remains `unverifiable`, not verified success. Explicit checks still determine `verified`/`not_verified`; failed checks pause. `nextStep: none` stays final. Continuation reuses the existing controller and obtains a new inspection/snapshot while retaining the original user goal and bounded previous-step context.
- No new dependency, browser permission, backend service, persistence, autonomous action, raw mutation logging or private-page content collection was added. The shared API role schema changed, so restart the local Worker before live verification to ensure client and backend agree.

### Automated evidence

| Exact command/check | Final result |
|---|---|
| `corepack pnpm typecheck` | Exit 0; shared/API/extension |
| `corepack pnpm lint` | Exit 0 |
| `corepack pnpm test` | Exit 0; **64 API + 71 extension unit tests passed** |
| `WRANGLER_LOG_PATH=/tmp/clickpilot-popup-wrangler.log corepack pnpm test:e2e` | Exit 0; extension production build and API Worker dry-run build passed, then **96/96 Chromium tests passed (2.2 minutes)**; no deployment/provider calls |
| Python production manifest/client inspection | Passed: unchanged permissions/loopback host, no static content injection, no provider credential configuration/endpoint, no production highlight logger |
| `git diff --check` | Exit 0 |

New deterministic coverage includes role/schema acceptance, priority/cap/registry identity, private-marker and native-option omission, portals, hidden-to-visible and animated/delayed menus, pointer-down opening, unrelated mutations, equivalent re-renders, transient and settled menu closing, failed explicit verification, observation timeout/cancellation, Manual highlight cleanup, fresh AI snapshots and goal retention. The full suite also reruns existing stale-target, cancellation, lifecycle, overlay and multi-step regressions. The existing Worker remained running on port 8787; tests used an isolated mock. Browser tests open panel HTML in a tab, so real Chrome side-panel verification is still required.

Logs: `/tmp/clickpilot-popup-typecheck.log`, `/tmp/clickpilot-popup-lint.log`, `/tmp/clickpilot-popup-unit.log`, `/tmp/clickpilot-popup-e2e-final.log`.

Intermediate evidence: the first unit run found one existing assertion expecting navigation-before-dialog order; the expected order was updated for popup priority. The first full browser run passed 94 and failed one new cap-fixture assertion: offscreen background controls left only 124 eligible controls. The fixture was corrected to actually present more than 150 controls in the viewport, and the final full run includes that regression plus a synchronous pointer-down popup. These intermediate runs are not final passing evidence.

### Manual Chrome verification

1. Restart the local API Worker with `corepack pnpm dev:api` if it has not reloaded the changed shared schema. At `chrome://extensions`, reload the unpacked extension from `apps/extension/.output/chrome-mv3`. In page, panel and extension-worker consoles, watch for unexpected errors. Existing consent is still required for AI; Manual inspection stays local.
2. ChatGPT: open a conversation and its three-dot dropdown yourself. Activate ClickPilot and inspect in **Manual highlights**. Expect supported visible Rename/Pin/Plugins/Archive/Delete controls that the website exposes to be listed and highlightable, with no conversation body or input values collected. Close the menu: its highlight must disappear. Reopen and inspect again: IDs must resolve the new live controls. A displayed disabled option must remain unselectable. For AI continuation, start with the menu closed and ask to be guided to an option; when guidance is continuing, click the menu trigger yourself and expect fresh menu context and the relevant next highlight.
3. YouTube: activate ClickPilot, choose **AI assistant**, read/accept the existing disclosure, and ask **“How can I switch accounts?”**. Expect account-button guidance first. Click it yourself. Within the bounded observation window, expect a fresh suggestion toward **Switch account** rather than no-progress solely because the menu appeared late. No option may activate automatically. A menu appearance without an explicit successful outcome must remain unverified. Real model decisions can vary; if a declared check genuinely fails, recovery remains correct.
4. Use the existing fixture server or run `python3 -m http.server 4173 --directory tests/fixtures`. Visit `http://127.0.0.1:4173/popup.html?crowded&preexisting`. Click Account yourself, inspect in Manual, and highlight Rename, Pin, Plugins and Switch account. Expect 150 controls, the menu options, and remaining background slots including Account/Close menu. Click Close menu: expect overlay removal. Reinspect after reopening. No synthetic account action should occur until you click Switch account.
5. Repeat AI fixture guidance on `popup.html`, `popup.html?preexisting`, `popup.html?delayed`, `popup.html?animation`, `popup.html?pointerdown`, and `popup.html?crowded`. Ask to switch accounts, then click the highlighted Account control yourself. Expect fresh Switch account guidance while keeping the original goal; delayed mode opens after 2.3 seconds. The changing noise timestamp must not cause request loops. Deterministic browser tests use mock AI replies; live Gemini wording/selection is not guaranteed.
6. While the delayed menu/observation is pending, separately Stop, replace the question, withdraw consent, switch tabs, navigate and close the panel. Expect no late highlight or extra request for the cancelled task. Close a menu before it settles: expect safe no-progress recovery if no lasting eligible change remains. Check Requests using only synthetic data: increasing step number, fresh snapshot ID, original goal and one bounded previous-step record; no values, page prose, screenshot or full history.

### Limitations and stop gate

- The five-second observation window and 150-control cap remain deliberate limits. A menu appearing after the window or options arriving after an earlier settled result can require Retry. If popup controls themselves exceed the cap, not all can fit. Layout/sample guards may reject clipped or covered targets. No arbitrary clickable-div, iframe, canvas, closed-shadow-tree or native browser-menu support was added.
- Changed eligible controls are evidence observed after the trusted action, not proof of causality or task success. Unrelated changes to actual actionable controls can still be ambiguous; ordinary unrelated prose and equivalent DOM re-renders are ignored. Existing privacy filtering remains heuristic. Actual Chrome side-panel behavior and signed-in website/model behavior require user verification; automated tests use synthetic pages and mocked AI only.

**STOP: AWAITING USER VERIFICATION.** Do not begin 6B, commit, push, deploy or publish without explicit approval.


## Milestone 6B plan clarification — 23 October 2026

Status: **AWAITING PLAN APPROVAL — IMPLEMENTATION NOT APPROVED**. The user requested a plan revision only. Updated `PLAN.md` and this progress record; no runtime files were changed for this request. The dynamic popup correction remains separately AWAITING USER VERIFICATION; no verification is inferred from this planning request.

- Distinguished surviving in-memory task ownership from disposable page/attempt resources. SPA/full navigation can retain the original goal, step count and bounded previous-action context while aborting stale work and obtaining a fresh sanitized snapshot. Guided continuing navigation can resume after access/identity checks; unrelated/manual or cross-origin navigation pauses for explicit Continue/reactivation. Final guidance, failed explicit checks, consent and finite request/step bounds remain enforced.
- Distinguished worker disconnect with a live panel (retain goal, pause/reconnect safely) from actual panel destruction (goal lost; restart notice and re-entry only). No background copy, persisted goal, reconstruction from prior instructions or automatic replay is proposed.
- Specified minimal trusted-context `storage.session` metadata, strict validation/expiry, owner/revision guards and serialized writes to prevent stale resurrection. Checkpoints contain no goal, URLs, instructions, inventories, snapshots, targets or geometry; they confer no permission or consent. Stop/termination clears metadata; panel loss can leave only a restart notice. Only `storage` permission is proposed, pending implementation approval.
- Added explicit transitions, deduplicated navigation/request accounting, access/activation boundaries, acceptance tests and six manual Chrome verification steps. Preserved popup observation, multi-step and overlay safeguards. Corrected the older 6A observation timing sentence to reflect the implemented popup correction's named 400ms settle/five-second maximum.
- Reviewed current source behavior: the existing panel hook calls terminal pause on tab/navigation/worker disconnect, and background page disconnect does not itself distinguish goal ownership. These are implementation changes planned for 6B, not changes made now. Consulted official Chrome activeTab/storage documentation for the permission/session-storage boundaries linked in the revised plan.
- Validation for this documentation-only revision: `git diff --check` — exit 0. Typecheck, lint, unit/browser tests, builds, provider calls and Chrome runtime verification were not run; none is claimed for this plan update.

**STOP:** Wait for explicit approval of the revised 6B plan before coding. No commit, push, deployment or publication is authorized.

## Milestone 6B implementation — 23 October 2026

Status: **AWAITING USER VERIFICATION**. The user explicitly approved the revised 6B plan with “ok , continue with 6B”. This authorization does not verify the outstanding popup correction or authorize Git operations, deployment, publication or milestone 7.

### What changed and why

- The side-panel controller retains the original goal, owned tab, finite step number and one bounded previous-step record across recoverable navigation and worker-port loss. Each invalidation replaces/aborts the attempt, clears page bindings, timers and overlays, and makes old inspection/provider/observation callbacks stale. No task owner or goal copy was moved into the worker.
- Continuing trusted link actions can resume on an activated, same-origin destination with a fresh document/navigation token and snapshot. Duplicate content/tab signals coalesce; one continuing action advances at most one step. Navigation during an already allocated provider step pauses and retries that same step. Unload outcomes are `unverifiable`; a known failed check remains failed. Final suggestions, text-only answers, manual navigation and different origins never initiate an automatic next step.
- Added **Continue task on this page** for explicit recovery, preserving the exact submitted goal even if the question draft changes. Tab changes retain ownership; a different active tab cannot take over the task. Closing the owned tab terminates it. Worker loss removes guidance, reconnects conservatively and waits for Continue/toolbar activation; it never replays an interrupted request. Destroying the actual panel document loses its goal, and reopening can show only a restart notice; re-entry starts a new session at step 1/null context with new consent as needed.
- Added bounded destination settling using the existing safe extraction approach: `PAGE_SETTLE_MS = 400`, `PAGE_MAX_WAIT_MS = 5000`, 100ms samples. Document readiness and eligible-control stability/animations matter; unrelated prose does not reset settling. Temporary collections do not replace the retained registry. Scoped cancellation tokens stop destination waits. Panel navigation coalescing uses `NAVIGATION_SETTLE_MS = 700`, `NAVIGATION_MAX_MS = 8000`, and `NAVIGATION_MAX_SIGNALS = 12`. Existing 20-step, one-refresh, privacy, pointer-transparency and live-target checks remain.
- Added only the approved **`storage` permission**. `chrome.storage.session['clickpilot.interruption']` is explicitly restricted to `TRUSTED_CONTEXTS`. Strict validation permits only version, opaque owner/session tokens, tab ID, active/interrupted status, revision and a 30-minute expiry. There are no goals, instructions, URLs, page inventories, snapshots, targets, geometry, consent or secrets in the record. Invalid/expired/missing-tab records are removed on access.
- A small background checkpoint module serializes writes/clears and checks live port ownership and monotonic revisions. Old owners, delayed writes and stale revisions cannot overwrite a replacement or resurrect a completed clear. Disconnect removes live ownership and can leave restart-only metadata. Stop, replacement, completion, consent withdrawal and owned-tab closure clear the marker; pending offline clears are retried on reconnection. Storage failures are visible and do not pretend that metadata was saved or restore authority.
- Added `tests/fixtures/navigation.html` with synthetic SPA/full-document Settings → Domains → Edit domain flows and manual/replace/cross-origin controls. README/local API documentation now explain recovery and its limits. No new dependency, backend change, host permission, screenshot, automatic website action, commit, push, deployment or real Gemini call was introduced.

### Actual automated evidence

The final full browser run passed **104/104** tests (3.0 minutes), including all eight new 6B cases, the final checkpoint-owner check and direct content-script storage-denial assertions. The earlier complete 104-test run and focused five/six-test runs also passed; the final full run supersedes them.

| Exact command/check | Result |
|---|---|
| `corepack pnpm typecheck` | Exit 0; shared/API/extension |
| `corepack pnpm lint` | Exit 0 |
| `corepack pnpm test` | Exit 0; **64 API + 91 extension unit tests passed** |
| `WRANGLER_LOG_PATH=/tmp/clickpilot-6b-wrangler.log corepack pnpm test:e2e` | Exit 0; production extension and API Worker dry-run builds passed, then **104/104 Chromium tests passed (3.0 minutes)**; isolated mocks, no Gemini/deployment |
| `WRANGLER_LOG_PATH=/tmp/clickpilot-6b-wrangler.log corepack pnpm build` | Exit 0; standalone build passed during implementation; the final full browser command above rebuilt the final runtime changes |
| Python production manifest/client inspection | Passed: only `activeTab`, `scripting`, `sidePanel`, `storage`; unchanged loopback host; no static content injection, provider credential configuration, provider endpoint or production highlight logger |
| `git diff --check` | Exit 0 |

Logs: `/tmp/clickpilot-6b-typecheck.log`, `/tmp/clickpilot-6b-lint.log`, `/tmp/clickpilot-6b-unit.log`, `/tmp/clickpilot-6b-build.log`, `/tmp/clickpilot-6b-e2e-final.log`. Build output: `apps/extension/.output/chrome-mv3`.

Unit coverage now includes goal/step retention, duplicate navigation, failed/final/text-only cases, pending old replies, new document vs wrong tab, connection loss, finite navigation budgets, unrelated actions, checkpoint strictness/expiry/missing tabs, owner/revision conflicts, delayed writes after Stop, storage failure, destination settling, loading timeout and immediate cancellation. Browser coverage uses isolated HTTP mock replies: SPA/full navigation, push/replace/back/forward, pending-reply rejection, cross-origin reactivation, tab ownership/closure, panel destruction/re-entry, forced worker termination, animated loading timeout/Stop and same-origin redirect chains. Existing popup, overlay, privacy and cancellation regressions remain in the full suite.

The initial sandboxed browser command could not bind the fixture server (`PermissionError: Operation not permitted`). Running the same local mock/Chromium checks with approved escalation resolved the environment restriction. An intermediate typecheck caught discriminated-union narrowing errors in the added navigation event; those were corrected before passing checks. No failed or unrun check is counted as a pass.

### Numbered manual Chrome verification

1. Run `corepack pnpm dev:api` with the existing backend-only configuration and `python3 -m http.server 4173 --directory tests/fixtures` in separate terminals. At `chrome://extensions`, reload the unpacked extension from `apps/extension/.output/chrome-mv3` and check its new `storage` permission. Open `http://127.0.0.1:4173/navigation.html`, click the ClickPilot toolbar icon, select **AI assistant**, read/accept consent and submit **Change a Vercel domain**. Watch page, panel and worker consoles for unexpected errors. No website action should happen before your click.
2. Follow Settings → Domains → Edit domain yourself when highlighted. Expect the original goal to stay unchanged, one new step per continuing link, fresh page/snapshot identity and unverified navigation status. Repeat at `navigation.html?full` for full document replacement. Inspect only synthetic request payloads: the goal, finite step count and one previous action are retained; no private values, old target geometry or history are restored. Actual Gemini selection can vary; automated tests establish deterministic recovery using mocks.
3. In separate runs use **Manual route**, **Replace route**, Back/Forward, or navigate while Gemini is replying. Expect the previous overlay/reply to clear and **Continue task on this page**, without a new question or automatic request. Use **Different origin**: Continue alone must not grant access; click the toolbar on that destination, then Continue. Switch tabs: the other tab cannot inherit the task; returning to the owned tab offers fresh continuation. Close the owned tab: expect task termination and marker removal. Try a protected page: expect unsupported/reactivation wording without silent access expansion.
4. With the panel document alive, stop its extension worker using Chrome's worker tooling (where available, `chrome://serviceworker-internals`, the matching `chrome-extension://<ClickPilot ID>/` worker, **Stop**). Keep the actual side panel open. Expect removed guidance and a connection pause, retained goal, no replay, reconnection and explicit Continue after toolbar reactivation if requested. Return to the owned fixture tab before continuing. Separately leave DevTools detached to observe natural suspension; record the behavior Chrome actually exhibits. The [Chromium service-worker debugging reference](https://new.chromium.org/blink/serviceworker/service-worker-faq/) describes the internal worker view; the forced automated test uses CDP termination, not a claim about natural suspension timing.
5. Close/reopen the real side panel during a reply, popup observation and navigation in separate runs. If Chrome preserves the hidden document, its task can remain paused in memory. Force actual document destruction by reloading the panel document with panel DevTools if needed. Reopening a destroyed document must show only **Previous task interrupted — enter your goal to restart** when valid metadata remains: no restored question, consent, instruction or overlay. Re-entering a goal must start a new session at step 1/null context. Repeat after Stop/completion/consent withdrawal: expect no marker/restart notice once the clear succeeds.
6. In panel/worker DevTools evaluate `chrome.storage.session.get('clickpilot.interruption')` using synthetic fixture data only. During the task expect exactly the allowed metadata, with no question, URL, page content, instructions, target or coordinates; after Stop expect no record. Separately corrupt/expire or remove the fixture record: reopening must require re-entry, never infer a goal. Repeat the existing popup and fake sensitive-marker checks. Stale highlights, late replies, changed goals, request loops, unsolicited website actions, exposed task text in storage or unexpected console errors fail verification.

### Known limits and stop gate

- Automatic navigation continuation is deliberately conservative for real highlighted links. Button-driven JavaScript routes can pause for Continue rather than guessing that a later unrelated navigation was caused by the click. The original goal survives in either case. Same-URL history-state changes are not treated as a distinct URL navigation; fresh DOM observation still handles eligible-control changes.
- Settling is a bounded control-inventory heuristic, not proof that a website has finished all work. Redirects or routes changing during inspection can pause; continuous animations/loading time out. Existing top-level DOM, 150-control, sensitive-content filtering and five-second popup observation limits remain. Cross-origin recovery always requires explicit continuation and actual browser access; worker restarts conservatively require toolbar activation.
- No agent-run real Gemini calls or signed-in website verification were performed. The automated panel HTML tab is not the real Chrome side panel. Forced CDP worker termination is covered; natural suspension and Chrome's hidden-vs-destroyed panel behavior remain manual checks. If transport/storage fails, a clear may wait for reconnection or expiry; a leftover marker still cannot restore a goal, consent, permission or targeting state.
- The popup correction remains separately awaiting user verification. No historical verification of earlier milestones is inferred here.

**STOP: AWAITING USER VERIFICATION.** Do not begin milestone 7, commit, push, deploy or publish without explicit authorization.

## Milestone 7A — Contextual text assistant — 25 October 2026

Status: **VERIFIED by the user**, 25 October 2026. The user confirmed that all manual verification is complete. Implementation and final automated checks complete. The user approved the scoped plan with separate strict result variants and a retained side-panel explanation. No new commit, push, deployment, publication or other milestone is authorized or performed.

### Base discrepancy resolved before coding

The clean `milestone-7A` worktree was at `79aaf6c` (6A), while both local/origin `milestone-6B` were at direct descendant `109e04f`. The earlier review correctly described that old checkout but missed the completed branch. Read the 6B commit and its progress/architecture/plan before implementation, then fast-forwarded the current branch to that existing commit. The sandbox first prevented writing Git's ORIG_HEAD lock; approved escalation performed only the fast-forward. It created no commit and made no network request. The user confirmed 6B completion in this turn; its prior evidence remains intact.

### Implementation and decisions

- Added shared text protocol 1 at `POST /v1/text/explain`, independently of unchanged guidance protocol 3. Strict Zod discriminated results: explanation requires quickExplanation (1–280) and detailedExplanation (1–2,000); clarification and unsupported require only message (1–600). Unknown fields, wrong variants, invalid identity, sensitive output and excessive strings are rejected. Identity envelopes are server-owned. Both surfaces render literal text only.
- Native Selection/Range handling processes completed trusted pointer/keyboard gestures, with selectionchange used only to notice changes. There is no mousemove handler or request on selection/opening/drafting. The frozen range/text survives input focus. Intersected nodes are checked with a bounded work limit; forms, inputs, editable/hidden/inert/sensitive contexts, unsupported roots and overlong selections are refused before values can be read. Control characters/whitespace are normalized and privacy filtering runs locally and in the Worker. Bounds: 2,000 selected UTF-16 code units, 240 question units, 16 KiB actual UTF-8 HTTP request/response bytes. Ordinary control extraction was not expanded to prose.
- Added a small Shadow DOM surface using the existing overlay host isolation. The existing guidance renderer uses the same extracted host helper with unchanged hidden/pointer-transparent behavior. The text composer has visible labels/focus, Ask/Cancel, Enter/Escape, IME guards, polite result feedback and a real-user-submit guard; script-only selection or form.requestSubmit cannot initiate a request. Only the bubble's controls accept pointer events.
- Positioning uses the final visible range rectangle, measured bubble size, above/below placement and viewport clamping. Current-frame geometry follows scroll, nested scroll, resize and zoom. Losing usable space removes floating UI without discarding a submitted request or completed detailed panel response. It does not scroll the website. Actual text/page invalidation clears the reply; a Close after a completed reply retains the panel explanation.
- Lifted the existing guidance connection to the panel root and shared it with Manual/Mock/AI views and the separate text controller. No second port/checkpoint owner was introduced. Opening the composer stops existing guidance/Manual decoration; starting guidance or inspection stops text assistance. Switching Mock/Manual cancels pending old Mock work. Text requests have session/request/tab/page/selection/attempt guards, explicit retry, AbortController cancellation, 25-second transport timeout and live selection checks before/after the provider. Stop remains effective through reconnect and late arm acknowledgements. Scoped enable/disable routing prevents an in-progress arm from leaving UI after Stop.
- Added a separate selected-text disclosure and volatile consent; guidance consent never authorizes prose. Only the normalized selected passage and question reach Gemini. The Worker does not receive site URL/origin/title, adjacent prose, control inventory, geometry, task context or history. Reused direct Gemini transport, backend secrets, local-only restriction, kill switch, 20-second upstream timeout, upstream/client byte bounds, redirect rejection, fixed safe errors, no-store headers and no body logging. This does not add public authentication, durable rate/spend controls or hosting.
- Kept text state transient. It never writes a 6B interruption checkpoint. The 6B session controller, checkpoint store, destination settling, continuation/checkpoint/settling unit tests and complete assistant browser suite are unchanged from `109e04f`. The manifest still contains only activeTab, scripting, sidePanel and storage with the same loopback host. No dependency, permission, screenshot/image, speech, memory or new framework was added.
- Updated PLAN.md, README.md and local API documentation with the separate scope and contract. The original optional screenshot milestone remains unapproved and unimplemented.

### Actual automated evidence

| Exact command/check | Result |
|---|---|
| `corepack pnpm typecheck` | Exit 0; shared/API/extension, final source |
| `corepack pnpm lint` | Exit 0; final source |
| `corepack pnpm test` | Exit 0; **92 API + 113 extension unit tests passed** |
| `WRANGLER_LOG_PATH=/tmp/clickpilot-7a-wrangler.log corepack pnpm build` | Exit 0; production extension and API Worker **dry-run** builds |
| `WRANGLER_LOG_PATH=/tmp/clickpilot-7a-wrangler.log corepack pnpm test:e2e` | Exit 0; intermediate complete run **127/127 Chromium tests passed (4.8 minutes)**, including all eight existing 6B cases; final small user-submit/mode-switch/reconnect guards were added afterward |
| `corepack pnpm exec playwright test tests/e2e/text-assistant.spec.ts --workers=1 --grep 'selection completes\|switching from\|nested scroll'` | Exit 0; **3/3 passed (12.7 seconds)** after the final guards, including refusal of scripted requestSubmit |
| `WRANGLER_LOG_PATH=/tmp/clickpilot-7a-wrangler.log corepack pnpm test:e2e --workers=2` | Exit 0; final production extension + API Worker dry-run builds; **128/128 Chromium tests passed (3.5 minutes)**, including all 104 pre-existing tests and 24 text cases |
| Python production manifest/client inspection | Passed: unchanged 6B permissions and loopback host; no static content scripts, GEMINI_API_KEY configuration, provider endpoint, captureVisibleTab, microphone/speech APIs or production highlight diagnostic logger in client JS |
| `git diff --exit-code HEAD -- apps/extension/src/features/session/session.ts apps/extension/src/features/session/checkpoint.ts apps/extension/src/features/observer/settle-page.ts apps/extension/tests/unit/checkpoint.test.ts apps/extension/tests/unit/continuation.test.ts apps/extension/tests/unit/settle-page.test.ts tests/e2e/assistant.spec.ts` | Exit 0; listed 6B core/coverage unchanged |
| `git diff --check` | Exit 0 |

New deterministic tests cover native pointer completion, keyboard selection, script-only changes/submission, input focus preservation, consent/no request before Ask, exact minimized payload, Cancel/Escape, literal hostile markup, all result variants, schema/privacy/byte failures, geometry/clamping/nested scroll/insufficient space, retained pending/completed panel replies, error/retry, new selections, Stop/withdrawal/navigation/SPA/tab/panel loss, detached text, manual handoff, mode replacement and late result/reconnect rejection. Existing 6A/6B/popup/overlay/privacy tests remain in the full suite. All provider traffic uses injected or isolated local mocks, with zero real Gemini calls and no deployment.

Intermediate failures were resolved rather than counted as passes: initial lint/type checks found unused mock parameters and narrowly inferred mock call tuples; the first browser invocation could not bind the local fixture server under the sandbox, so the same isolated local checks used approved escalation. The initial text run caught validation of an internal message wrapper as if it were the strict HTTP envelope; the wrapper now carries the validated response as value. The browser harness was corrected to open its substitute panel after toolbar activation to avoid competing with an actual headless panel, and keyboard selection uses a platform-independent native Shift+Arrow gesture instead of macOS Home/End assumptions. An early focused text run passed 21/21 before the extra handoff/viewport cases. No intermediate failure is presented as final success.

Visual inspection: viewed synthetic screenshots `/tmp/clickpilot-7a-bubble.png` and `/tmp/clickpilot-7a-panel.png` from Chromium. Compact bubble and 360px panel text are readable with no clipped controls. Browser tests use the panel HTML in a tab; this is not a claim that the actual Chrome side-panel lifecycle or real Gemini output was manually verified.

Logs: `/tmp/clickpilot-7a-typecheck.log`, `/tmp/clickpilot-7a-lint.log`, `/tmp/clickpilot-7a-unit.log`, `/tmp/clickpilot-7a-build.log`, `/tmp/clickpilot-7a-focused.log`, `/tmp/clickpilot-7a-e2e.log`, `/tmp/clickpilot-7a-e2e-final.log`. Build output: `apps/extension/.output/chrome-mv3`.

### Numbered manual Chrome verification

1. Start the existing local Worker with `corepack pnpm dev:api` using its existing ignored backend-only configuration, and serve fixtures with `python3 -m http.server 4173 --directory tests/fixtures`. Reload the unpacked extension from `apps/extension/.output/chrome-mv3` at `chrome://extensions`. Open `http://127.0.0.1:4173/text.html`, activate the ClickPilot toolbar and leave the actual side panel open. No new permission should be requested. Watch page/panel/worker consoles for unexpected errors.
2. Leave selected-text consent unchecked. Drag across the Photosynthesis paragraph: expect one Ask ClickPilot button only after release. Open it, type a question, then Cancel; repeat with Escape and keyboard selection. Expect stable passage context when focus moves to the input, usable keyboard focus and zero `/v1/text/explain` requests. Ask must be disabled until the separate selected-text consent is checked. No website action should occur on its own.
3. Check **Allow selected text and questions to be sent to Gemini** in the panel. Reselect the public paragraph, open the composer, ask **Explain this passage in simple terms**, and press Ask/Enter. Expect a short local explanation and a more detailed panel response; actual wording can vary. Inspect only the synthetic request in worker DevTools: exactly text protocol 1, operation, opaque identities, selectedText and question; no URL/query/hash/title, other prose, input values, controls, geometry or history. There must be no request before explicit submission.
4. Scroll the page and the nested scrolling box, resize the window/side panel and change Chrome zoom. Expect alignment or safe removal when space/anchor visibility is lost. The detailed panel answer must remain when only the bubble disappears; closing a completed bubble also keeps it. The normal website button must still work when you click it. Select a new passage: the old reply must be replaced rather than applied to the new selection.
5. Try the email-containing passage, editable content, passage crossing the editable span, form prose and password/ordinary inputs. Expect no bubble/request for these excluded selections. A passage over 2,000 code units must be refused. Do not use real sensitive data. For a live error check, stop the Worker before Ask: expect a safe error and explicit Retry/Cancel, never a fabricated explanation. Restart it to Retry. Mocked automation covers malformed output, quota, byte bounds and hostile markup without exhausting real quota.
6. While a response is pending, separately Cancel, Stop text assistant, withdraw selected-text consent, make another selection, navigate normally/with SPA history, switch tabs, and close the actual panel. Expect no late reply or floating UI. Stop must remain stopped until Resume/toolbar activation. Reopen a destroyed panel: selected text/question/consent must not be restored. Use Resume text assistant on an activated page to start again. A request already accepted upstream may still consume provider quota despite cancellation.
7. Re-run the existing 6B navigation fixture in AI assistant mode: original goal through Settings → Domains → Edit domain for SPA and `navigation.html?full`, worker interruption/reconnection, cross-origin toolbar reactivation, explicit Continue and panel-destruction restart notice. Expect original-goal retention and fresh snapshots exactly as before, with no selected prose in `chrome.storage.session['clickpilot.interruption']`. Starting guidance must clear text UI; opening a text composer must end the old guidance. Use Manual highlights and Mock mode replacement too. Late decoration, request loops, changed goals, restored prose, blocked website interactions or unexplained console errors fail verification.

### Known limits and stop gate

- Chrome desktop ordinary top-level DOM text only. Frames, shadow roots, canvas, PDF viewers, editable content and sensitive/form contexts are unsupported. Conservative filtering/work/geometry limits can reject harmless passages. Oversized/unsupported selections do not produce an offer. Filtering is heuristic, not proof that arbitrary text is free of personal information.
- Positioning uses a simple visible range rectangle and viewport bounds; heavily clipped/transformed layouts can fall back to the panel. A new selection or actual page/text invalidation clears the previous reply; pure geometry loss keeps the detailed explanation. Selecting without enough local space to open a composer requires selecting a smaller/visible passage.
- No real Gemini, signed-in website, actual Chrome side-panel closure or natural worker suspension was verified by the agent. Synthetic API/unit/browser evidence remains distinct from the user's required manual Chrome verification. Existing local-only backend/security and upstream cancellation limits remain.

**STOP: VERIFIED.** No deployment, publication or next milestone is authorized.


## Milestone 7A Git authorization — 25 October 2026

The user requested: “ok, good commit these changes and push the milestone-7A”. This explicitly authorizes committing the scoped 7A implementation, shared contract, API/extension tests, synthetic fixture and documentation and pushing branch `milestone-7A` to the configured origin, `https://github.com/anantjain-afk/ClickPilot.git`. The implementation has not changed since the recorded final successful checks; this handoff adds only authorization documentation. The user subsequently explicitly confirmed that all manual verification is complete; 7A is VERIFIED. Commit `490d179` was pushed to `origin/milestone-7A`. No deployment, publication, merge or next milestone is authorized.

## UX-1 — Reliability, onboarding and clear messaging — 25 October 2026

Status: **VERIFIED by the user**, 25 October 2026. The user explicitly confirmed “ux-1 is verified” and approved UX-2. The user approved the reviewed UX-1 plan with “ok approved”. This record covers UX-1; the minimal UX-2 redesign was subsequently approved by the user. No commit, push, deployment or publication was performed. Existing local PLAN.md/PROGRESS.md edits were preserved.

### Root cause and implementation

- Reproduced the restart failure before changing implementation: removed the required second toolbar click from the existing forced-worker-loss regression and ran it against the previous build. Continue could not render the next highlight. The `activatedOrigins` Map existed only in worker memory, so a restarted worker rejected still-permitted tabs. The original 6B test explicitly required reactivation and therefore did not cover the desired behavior.
- Replaced that volatile Map with small trusted `chrome.storage.session` records at `clickpilot.activation.<tabId>`, containing only the deliberately activated origin. Every use checks both that record and Chrome’s actual scripting access using a no-op script. Same-origin navigation retains intent; cross-origin/inaccessible navigation, failed probes and tab closure remove it. Stored intent never confers access. The 6B interruption record remains unchanged and contains no URLs/task text.
- Kept the existing panel/session coordinator and bounded automatic reconnect attempts, with increasing delays and additional focus/toolbar/explicit Reconnect triggers when disconnected. There is no heartbeat, idle traffic or periodic reconnect polling. Old attempts/targets are invalidated and never replayed. The live panel retains its exact goal and already displayed webpage/text replies; connected-again wording offers Continue for fresh inspection. Pending text questions remain visible with instructions to reselect, without offering a retry that can no longer work. Explicit Stop stays stopped across connection loss.
- Distinguished temporary port loss from explicit Stop. A page can retain an unsent text draft in volatile memory, remove its surface while disconnected, and restore it only to the same surviving panel session after revalidating access, page/range identity and selection binding. A different/destroyed panel cannot recover it. Stop, revocation, navigation and invalidation discard it. A late old page-port disconnect cannot clear a newer connection. The selection collector and overlay renderer were not rewritten.
- Added one short first-use screen with two optional, initially unchecked choices: Webpage guidance and Selected-text assistance. Settings can change/revoke each independently. Store only `{version: 1, onboardingComplete, guidance, selectedText}` in trusted `chrome.storage.local['clickpilot.ai-sharing']`. Missing, malformed, incomplete, unknown-version and unfinished records authorize no sharing. Chrome activation remains separate. Existing volatile opt-ins are not silently migrated. No page/task text, passage, question, answer or chat history is stored in preferences.
- Reflect checkbox gestures immediately while a new grant remains blocked until its save succeeds. Revocation takes effect immediately even if saving fails; errors explain the limitation and offer retry. Initial reads cannot overwrite newer storage changes. Preferences propagate to open panels. Both the panel and worker enforce the matching consent, including a second worker check immediately before upload; storage changes cancel affected pending work. Guidance consent cannot authorize selected prose or the reverse. A request already accepted upstream may still consume quota.
- Replaced ordinary provider/invalid-reply/snapshot jargon with connection, safe-reply and page-change messages. Fixed error codes remain available internally through Error.cause and the unchanged backend diagnostics/contracts. Sensitive-page refusal remains a privacy message; genuine access loss still explains the toolbar gesture. No new permission, host, dependency, framework, backend protocol, screenshot, buddy, voice or persistent history feature was added.

### Actual automated evidence

| Exact command/check | Result |
|---|---|
| `corepack pnpm exec playwright test tests/e2e/assistant.spec.ts --workers=1 --grep '6B forced worker loss'` against the previous build, without the second toolbar click | **Failed as expected before implementation**: no next highlight after Continue; `/tmp/clickpilot-ux1-before.log` |
| `corepack pnpm typecheck` | Exit 0; final shared/API/extension source |
| `corepack pnpm lint` | Exit 0; final source |
| `corepack pnpm test` | Exit 0; **92 API + 119 extension unit tests** |
| `WRANGLER_LOG_PATH=/tmp/clickpilot-ux1-wrangler.log corepack pnpm build` | Exit 0; final production Chrome extension and API Worker **dry-run** build |
| Focused Playwright command below | Focused run passed **6/6 (11.1s)** |
| `WRANGLER_LOG_PATH=/tmp/clickpilot-ux1-wrangler.log corepack pnpm test:e2e --workers=2` | Exit 0; initial full run **131/131 (2.5m)**; final full run after completed webpage-answer retention and connection wording **131/131 (2.6m)**, with production/dry-run builds |
| Python final production manifest/client inspection | Passed: unchanged activeTab/scripting/sidePanel/storage and loopback host, no static content scripts, provider key configuration/endpoint, screenshot or speech APIs, or temporary diagnostics in client JS |
| `git diff --exit-code HEAD -- apps/api packages/shared apps/extension/wxt.config.ts pnpm-lock.yaml apps/extension/src/features/observer apps/extension/src/features/overlay apps/extension/src/features/session/checkpoint.ts apps/extension/src/features/text-assistant/selection.ts` | Exit 0; these systems/contracts/permissions/dependencies remain unchanged |
| `git diff --check` | Exit 0 after final documentation update |

Focused command (shown outside the table so regex alternation remains copyable):

```sh
corepack pnpm exec playwright test tests/e2e/panel.spec.ts tests/e2e/assistant.spec.ts tests/e2e/text-assistant.spec.ts --workers=2 --grep 'first-use|direct AI|6B forced worker loss|worker restart retains|panel explanation, exact tooltip|selection completes'
```

Only **six new unit tests and three new browser cases** were added. Existing cases were updated/reused for stored consent, Stop/revocation, late-response rejection and reconnect. Coverage includes pending-grant blocking, failed revocation/retry, late initial reads, strict preference records, actual permission-probe failure, cross-origin activation cleanup, first-use persistence, independent worker consent enforcement, unsent draft/completed reply retention and the complete existing guidance/text/overlay/privacy suite. The forced-worker guidance case now uses `localhost`, without a permanent host permission, and verifies original session/goal retention and a completed webpage answer across separate forced worker losses.

Intermediate issues were fixed, not counted as passes: the sandbox initially prevented the fixture server from binding its local port, so local browser checks used approved escalation. Lint found one unused test parameter. Focused tests caught an asynchronously controlled checkbox reverting visually before storage completed, an ambiguous status locator, and the headless harness running both a real panel and its substitute tab. With persisted consent those two panels competed to rearm text after worker loss. The harness now suppresses only sidePanel.open during genuine CDP toolbar gestures, leaving one substitute owner while retaining actual activeTab grants. Temporary content-free lifecycle diagnostics used to locate this were removed from final source/build.

Visual inspection: viewed first-use setup at 360px and 260px, then the final onboarding and expanded Settings captures. Text and controls are readable and the narrow page has no horizontal overflow. Evidence: `/tmp/clickpilot-ux1-onboarding-360.png`, `/tmp/clickpilot-ux1-onboarding-260.png`, `/tmp/clickpilot-ux1-settings-260.png`. These are synthetic browser captures, not actual Chrome side-panel verification. The full chat layout remains UX-2.

Logs: `/tmp/clickpilot-ux1-typecheck.log`, `/tmp/clickpilot-ux1-lint.log`, `/tmp/clickpilot-ux1-unit.log`, `/tmp/clickpilot-ux1-build.log`, `/tmp/clickpilot-ux1-focused.log`, `/tmp/clickpilot-ux1-e2e.log`, `/tmp/clickpilot-ux1-e2e-final.log`. Build: `apps/extension/.output/chrome-mv3`. All agent-run provider traffic used synthetic fixtures and mocks; no real Gemini call was made.

### Numbered manual Chrome verification

1. Start the existing configured local backend with `corepack pnpm dev:api` and serve fixtures with `python3 -m http.server 4173 --directory tests/fixtures` if not already running. Reload the unpacked extension from `apps/extension/.output/chrome-mv3` at `chrome://extensions`. Open `http://localhost:4173/navigation.html` and activate the toolbar. Expect no new browser permission request. For these checks use public/synthetic text only, and watch page/panel/worker consoles for unexpected errors.
2. On first use, expect both sharing choices unchecked and an explanation separating Chrome access from AI sharing. Save both off: local Mock/Manual tools should remain available, Ask Gemini should be disabled, and no AI request should occur. Enable only Webpage guidance in Settings; Selected-text assistance must remain off. Reload the panel and then restart Chrome: expect the choices remembered and no repeated onboarding. Browser restart still requires toolbar activation; it must not require consenting again. Test the opposite combination too. To repeat first use intentionally, remove only `clickpilot.ai-sharing` from local extension storage in panel DevTools; this revokes sharing. Check keyboard focus and narrow panel sizing.
3. With Webpage guidance enabled and the toolbar activated on `localhost`, ask a synthetic navigation goal or a simple question. With the actual panel document alive, stop its worker using Chrome’s worker tooling (where available, `chrome://serviceworker-internals`, the matching extension worker, Stop). Expect safe removal of old targets, the original question/goal and any completed reply retained, automatic reconnection and a connected-again message. Continue should inspect fresh context and guide without another toolbar click on that still-permitted origin. No old request may replay. Separately detach DevTools and leave it idle for at least 45 seconds, then use it again to check natural suspension; record what Chrome actually does.
4. Open `http://localhost:4173/text.html`, enable Selected-text assistance, select the public paragraph and open Ask ClickPilot. Type a draft without submitting; interrupt the worker while keeping the page and panel alive. Expect the same draft to return with no upload until explicit Ask. Submit it and repeat worker loss after the explanation appears: expect the detailed panel answer retained and no automatic second request. Selecting new text, navigation or explicit Stop should clear the old binding/draft.
5. In separate runs, submit guidance/text and immediately turn off its sharing choice in Settings. Expect stopped work, removed decoration and no late reply or automatic follow-up. Reload/reopen: expect that choice still off. The other category must retain its own setting. Ask/Retry must not upload without the relevant choice. Stop must remain stopped after worker loss until explicit Resume/new guidance/toolbar activation. Already sent provider requests may have reached Google before cancellation.
6. Repeat the navigation fixture for SPA and `navigation.html?full`, following Settings → Domains → Edit domain yourself. Try Different origin, tab switching/return, missing/covered targets and panel destruction. A different origin must require its own toolbar gesture even though sharing is remembered; Continue alone must not grant access. A surviving panel keeps its owned goal, while a destroyed panel requires goal re-entry, optionally with the existing restart reminder. Sharing preferences survive panel destruction; task text and selected passages do not. No website action may occur before your own click/type. Stale targets, lost replies solely from worker sleep, request loops, unexpected uploads or console errors fail verification.

### Known limits and stop gate

- Actual Chrome side-panel opening/closure/document preservation and natural worker suspension remain manual checks. Headless tests use a substitute panel tab and explicitly suppress the extra real panel; forced CDP termination does not prove natural lifecycle timing. No signed-in site or live Gemini response was verified by the agent.
- Interrupted guidance pauses for explicit Continue with fresh context instead of replaying a request. Pending selected-text requests are cancelled and require reselecting; they are not silently retried. Draft restoration requires the same live panel session, page and valid visible range; geometry/visibility/navigation changes can discard it safely. Browser/extension restart clears session activation metadata, not saved AI preferences.
- Storage failure is visible and fails closed for new grants. A failed revocation save keeps sharing off in that panel and asks the user to retry saving before closure; it cannot pretend the stored preference changed. Existing filtering, top-level DOM, local-only backend, cancellation/quota and single-owner recovery limits remain.

**STOP: VERIFIED.** UX-2 was subsequently approved with a manual-verification-only testing instruction. No commit, push, deployment or publication is authorized.

## UX-2 — Minimal chat sidebar — 25 October 2026

Status: **VERIFIED by the user**, 26 October 2026. The user explicitly confirmed “UX-2 is verified”. The user confirmed UX-1 verification and approved UX-2, asking to keep only a very minimal chat-like interface. Their subsequent instruction, “just fix the ui , i will check manually no need for any tests”, overrides the usual automated-test gate for this milestone. No unit or browser tests were added or run. Existing uncommitted UX-1 implementation and documentation were preserved. No commit, push, deployment or publication was performed.

### UI changes

- The default panel opens directly to the existing AI assistant, with a small ClickPilot header, one More options button, a quiet empty state, conversation messages and a bottom composer. Ordinary use has no mode tabs, developer badges, large disclosure blocks or separate text-assistant card. The composer supports Enter to send, Shift+Enter for a line break and IME composition; its input retains the existing 240-character limit.
- User questions and validated assistant results appear in one transcript. Selected-text questions/detailed explanations use the same transcript while keeping the existing selection bubble flow. History lives only in the panel document and is never written to storage, attached to API requests or used to reconstruct lost tasks. Strings render literally through React text children. A small useConversation hook separates display history from layout and delegates all requests to the existing controllers.
- Contextual Stop, Retry, Continue and Done controls appear when needed. Retry can reuse the last explicitly submitted question when the original run has ended. Existing cancellation, outcome confirmation, navigation recovery, consent and stale-result guards remain in the controllers. New chat explicitly stops active assistance and clears the local transcript/draft.
- Settings, Text selection and Developer tools live behind More options. Settings edits the same UX-1 preferences; Text selection enables/stops the existing selection assistant. Developer tools preserves Manual Highlights, element lists and Mock guidance/scenarios. The ManualInspection component was moved unchanged from main.tsx into its own UI file, with only import-path/export changes. The old standalone TextAssistant presentation was replaced by the shared transcript and secondary controls; its controller/selection/bubble logic remains intact.
- Visiting Settings does not unmount the conversation or recreate the guidance connection. Messages and the composer draft remain available on return. Starting a Manual/Mock tool still ends active guidance; returning to chat stops that local tool. Auto-scroll follows new content when already near the bottom and allows reading older messages without being pulled down.
- Replaced the accumulated panel stylesheet with simple layout rules for the header, scrollable conversation, bottom composer and secondary views, retaining styles for local developer tools and onboarding. Kept the existing green identity, native controls, visible keyboard focus, literal messages, narrow-panel wrapping and reduced-motion support. No images, animation library, component/state framework, dependency, permission, backend or API contract was added.

### Actual checks and visual evidence

| Exact command/check | Result |
|---|---|
| `corepack pnpm typecheck` | Exit 0; shared/API/extension |
| `corepack pnpm lint` | Exit 0 |
| `WRANGLER_LOG_PATH=/tmp/clickpilot-ux2-wrangler.log corepack pnpm build` | Exit 0; Chrome production build and API Worker **dry-run** only |
| `git diff --check` | Exit 0 after final documentation |
| `node /tmp/clickpilot-ux2-preview.cjs` | Exit 0; two local empty-chat captures using the existing Playwright library in an isolated Chromium profile. No test runner, assertions, message submission, fixture workflow or AI requests. HTTP(S) traffic blocked in the preview profile. |
| Unit/browser tests | **NOT RUN**, explicitly requested by the user; no new tests |

Viewed the empty chat at 360×760 and 260×650: readable header and empty state, no clipping, and the composer at the bottom. An initial capture taken immediately after viewport resize was incomplete; recaptured using fresh pages after font/layout frames settled, then viewed both final files. Evidence: `/tmp/clickpilot-ux2-chat-360.png`, `/tmp/clickpilot-ux2-chat-260.png`. The final small Settings sentence clarifies session-only message lifetime; the empty-chat captures remain representative. These are visual previews of the extension page in a tab, not actual Chrome side-panel workflow verification.

Logs: `/tmp/clickpilot-ux2-typecheck.log`, `/tmp/clickpilot-ux2-lint.log`, `/tmp/clickpilot-ux2-build.log`. Loadable output: `apps/extension/.output/chrome-mv3`. No live Gemini or real-site workflow was exercised by the agent.

### Manual Chrome verification

1. Run the existing configured local backend (`corepack pnpm dev:api`) and fixture server (`python3 -m http.server 4173 --directory tests/fixtures`) if needed. Reload the unpacked extension from `apps/extension/.output/chrome-mv3` in chrome://extensions. Activate it on an ordinary fixture page. Expect only branding/menu, a simple welcome and bottom composer; no mode tabs, raw controls or repeated consent prompts. Resize the side panel: expect readable content, no horizontal overflow and a bottom composer.
2. Enable Webpage guidance through More options → Settings if it is off, then Back to chat. Ask a synthetic page question and a guidance task. Expect your questions and replies as messages, a cleared composer after sending, and only relevant task controls. Try Enter, Shift+Enter and keyboard focus. Follow a multi-step highlight yourself, then Stop/Retry/Continue/Done as applicable. Expect the existing behavior with no automatic website actions and no late response after Stop/replacement. Check page/panel/worker consoles for unexpected errors.
3. Type an unsent draft, visit Settings, then Back to chat. Expect both draft and prior messages retained. Repeat with a response arriving while Settings is open, and after a worker interruption using the verified UX-1 procedure. Scroll up in a longer conversation: new content must not force you down while reading. Use New chat: expect cleared messages/input and cancelled active work. Destroy/reload the panel document: expect no restored transcript or goal, while sharing preferences remain saved.
4. Through More options → Text selection, enable the existing selection assistant. On text.html select a public passage and ask beside it. Return to chat: expect its question and detailed explanation in the transcript, with selected-text context identified on the question. Try cancellation and consent revocation separately; expect no late answer or extra uploads. The sidebar composer still asks about the page; selected-passage questions use the existing floating composer.
5. Through More options → Developer tools, choose Manual Highlights and Mock guidance in separate runs. Expect the existing control inspection/highlights and local mock scenarios. Back to chat must end local tooling and retain prior conversation messages. Recheck missing targets, navigation, tab changes, genuine reactivation, saved consent and worker recovery in actual Chrome. Lost drafts/messages during view changes, clipped controls, incorrect requests, stale decoration or unexpected website actions fail verification.

### Limits and stop gate

- Functional and real Chrome side-panel verification is intentionally left to the user. Typecheck/lint/build and empty-state previews do not establish guidance, selection, cancellation or menu workflow correctness. Existing automated browser specs still target the prior panel controls and were not updated/executed under the user’s UI-only instruction; historical UX-1 results do not verify UX-2.
- Display history is temporary. It is not model conversation memory and is lost when its panel document is destroyed. A selected passage is still submitted via the existing on-page composer, with its independent consent; the sidebar does not silently attach it to ordinary messages.

**STOP: VERIFIED.** UX-3 planning was subsequently requested; implementation, Git operations, deployment and publication remain unapproved.

## UX-3 — Floating Buddy planning — 26 October 2026

Status: **AWAITING PLAN APPROVAL — IMPLEMENTATION NOT APPROVED**. Read the attached brief, current architecture/plan/progress and actual session, checkpoint, background, content, Shadow DOM, permissions and UX-2 presentation code. Confirmed UX-2 verification from the user's explicit message. Runtime source is unchanged. No tests/builds/provider calls or Git operations were performed for this planning request; documentation diff checked only.

The current panel owns createAssistantSession/createTextSession and their event/connection lifecycle. Background request/cleanup state is scoped to its panel port; the checkpoint store has a single panel owner, not per-tab ownership. useConversation records display history in the panel. The shared overlay helper currently creates open Shadow DOM. Therefore adding a floating widget alone cannot meet sidebar-independent navigation/recovery requirements.

Proposed plan is recorded in PLAN.md and presented for approval. Its principal approval gate is replacing panel-owned task authority with a per-tab recoverable worker coordinator and explicitly allowing a bounded, trusted, in-memory session recovery record containing filtered current task text/latest result. This would exceed 6B's metadata-only policy. Filtering cannot guarantee absence of personal information, so it is not silently authorized. If this exception is declined, the smaller alternative retains current metadata-only storage and requires goal re-entry after full navigation when no owning panel document survives. No claim that all UX-3 continuity requirements can be met under that alternative.

Chrome official references reviewed: extension worker lifecycle, storage.session, activeTab, content-script isolation and user-gesture requirements for sidePanel.open. The UX-3 brief explicitly requests a small focused test set, superseding UX-2's milestone-specific no-test instruction. No tests were created at planning time.

**STOP: AWAITING PLAN APPROVAL.** No UX-3 implementation, UX-4, commit, push, deployment or publication is authorized.

## Mascot visual redesign — 27 October 2026

Status: **AWAITING USER VERIFICATION**. Implemented the approved visual UI scope only. The user limited changes to files needed for this UI and asked to skip backend tests. Historical milestones above retain their original status; this entry records the current redesign without treating automated evidence as user approval.

### What changed and why

- Created one original, compact green enamel workshop robot with a single visor, expressive ivory eyes, a brass neck and an ivory repair panel. Shared native SVG artwork keeps the floating buddy, expanded ask card and sidebar consistent without adding image assets or dependencies.
- Refreshed the sidebar empty state, conversation, composer, settings, selection bubble and guidance tooltip with warm ivory/charcoal surfaces, readable type and a restrained green accent. Light/dark themes follow `prefers-color-scheme`. The launcher is 56px; existing positioning expectations were adjusted to its actual size.
- Added subtle local cursor eye movement and a brief hover/focus blink. Existing task states determine head moods; there is no looping idle movement. Reduced-motion CSS removes animation and transitions. Existing keyboard focus, drag controls and task actions remain available.
- UI files: `apps/extension/entrypoints/sidepanel/{main.tsx,style.css}`, `apps/extension/src/features/buddy/{companion.ts,CompanionAvatar.tsx,companion.css,buddy.css,buddy.ts,position.ts}`, `apps/extension/src/features/session/AssistantPanel.tsx`, `apps/extension/src/features/overlay/renderer.ts`, `apps/extension/src/features/text-assistant/bubble.ts` and `apps/extension/src/lib/ui-tokens.ts`. Only three existing launcher geometry expectations changed in `coordinator.test.ts`; no new behavior tests or dependencies were added.
- Existing controls, permissions, backend and task coordinator behavior were kept intact. No voice, screenshot feature, Git commit/push, deployment or publication was introduced. `PROGRESS.md` is the documentation handoff; no design/skill artifacts were added.

### Actual checks and baseline comparison

| Exact command/check | Result |
|---|---|
| `corepack pnpm exec eslint apps/extension` | Exit 0 |
| `corepack pnpm --filter @clickpilot/extension test` | Exit 0; **124 tests in 13 files passed** |
| `corepack pnpm --filter @clickpilot/extension build` | Exit 0; unpacked output `apps/extension/.output/chrome-mv3` |
| `corepack pnpm --filter @clickpilot/extension typecheck` | Exit 2; exactly three existing TS2339 errors in `src/features/session/background-tasks.ts`: line 246 (`type`), line 248 (`tabId`, `snapshot`) |
| `corepack pnpm exec tsc --noEmit --project /tmp/clickpilot-redesign-baseline/apps/extension/tsconfig.json` | Exit 2; untouched HEAD snapshot reproduced the same three type errors |
| `corepack pnpm exec playwright test tests/e2e/buddy.spec.ts tests/e2e/overlay.spec.ts --workers=1` | Exit 1; **41/42 passed**. Sole failure: existing `overlay.spec.ts:241`, panel disconnection leaves one overlay when zero is expected |
| `corepack pnpm exec playwright test tests/e2e/overlay.spec.ts --grep '20 — panel disconnection' --workers=1` in `/tmp/clickpilot-redesign-baseline` | Exit 1; the same overlay failure reproduced against the built untouched HEAD snapshot |
| `corepack pnpm exec playwright test tests/e2e/buddy.spec.ts tests/e2e/text-assistant.spec.ts --workers=1` | Exit 1; **28/31 passed**, including all six buddy workflows. Three selected-text failures: missing unsent-draft composer after worker restart (`text-assistant.spec.ts:122`); the error case waits for the obsolete `Retry explanation` label, while the current UI exposes `Retry` (`:178`); panel close leaves one pending selection bubble when zero is expected (`:197`) |
| Baseline selected-text command below, in `/tmp/clickpilot-redesign-baseline` | Exit 1; all three selected-text failures reproduced against untouched HEAD. Baseline log: `/tmp/clickpilot-redesign-baseline-text-browser.log` |
| `node /tmp/clickpilot-redesign-preview.cjs` | Exit 0; synthetic localhost extension renders with two intercepted responses, external requests blocked, no real backend/AI calls and no page errors |
| `git diff --check` | Exit 0 after documentation handoff |
| Backend tests | **NOT RUN**, as requested |

Exact baseline selected-text command:

```sh
corepack pnpm exec playwright test tests/e2e/text-assistant.spec.ts --grep 'worker restart retains|MOCK text result: error|cleanup: close' --workers=1
```

The initial sandboxed browser run could not bind the local fixture server. The rerun with local tooling access executed the checks; no automatic approval review rejection occurred. The three baseline type errors and four distinct baseline browser failures remain outside this UI scope; typecheck and neither combined browser run are reported as passing. All six buddy workflows passed in both focused runs.

### Visual and accessibility evidence

Inspected twelve synthetic captures covering compact, ask, thinking, answer and guiding states; light/dark expanded cards; empty sidebar at 360px and 260px; a conversation; and narrow dark settings. Panels at both widths had no horizontal overflow. Reduced-motion computed styles showed `animation: none` and `transition: 0s`. Secondary-text contrast was at least 4.60:1. A fresh finish review of the captures and source returned **SHIP TO USER VERIFICATION**, with no material findings. The skill detector engine was unavailable, so screenshot and manual source review supplied the visual review instead.

Captures in `/tmp/clickpilot-redesign/`: `compact-light.png`, `ask-light.png`, `thinking-light.png`, `answer-light.png`, `guiding-light.png`, `ask-dark.png`, `sidebar-empty-light-360.png`, `sidebar-empty-light-260.png`, `sidebar-empty-dark-360.png`, `sidebar-empty-dark-260.png`, `sidebar-conversation-light-360.png`, `settings-dark-260.png`. `ask-dark.png` shows a stopped conversation in the expanded card, not a fresh greeting. These synthetic previews do not establish real Chrome side-panel behavior or live service correctness.

### Numbered manual Chrome verification

1. Reload the unpacked extension from `apps/extension/.output/chrome-mv3` at `chrome://extensions`. Start the existing configured service and fixture server if needed, then activate ClickPilot on a permitted ordinary page. Expect the green robot and refreshed UI without a new permission request. Keep page, panel and worker consoles open; unexpected errors fail verification.
2. Hover and focus the buddy: expect subtle eye movement and a brief blink without idle looping. Click to expand, drag to another position, and use Alt+Arrow keys and Home while the launcher is focused. Try Escape, Close and Hide. Expect existing movement/dismissal controls to work, no duplicate cards and no blocked page controls.
3. With the existing sharing setting enabled, explicitly submit a synthetic question to the configured service. Expect thinking and answer states with the same robot. Start guidance and follow the highlighted target yourself: waiting, Stop and Done must remain usable. No page click, typing, submission or navigation may happen automatically; stale decoration or a late answer after Stop fails verification.
4. Open the sidebar from the expanded card. Expect the card to collapse and the existing task/result to remain available in the shared sidebar. Test the conversation composer, menu and settings with keyboard focus; losing the current task, missing controls or clipped content fails verification.
5. Enable the existing selected-text assistant, select public fixture text and open its bubble. Expect the refreshed styling and the same explicit question/submission flow. Merely selecting text must not submit a request. Check the answer and Stop behavior through the existing controls.
6. Switch the system/browser between light and dark appearance. Check a narrow sidebar, browser zoom and long replies/settings: expect readable text, visible focus and no horizontal overflow. Scroll and resize during guidance: highlights/tooltips must stay aligned and decorative overlays must allow normal clicks through to the page.
7. Enable the operating system/browser reduced-motion preference and repeat hover/focus and task-state changes. Expect no animation or transitions, with all controls still usable. Record any visual or console failure before approving this redesign.

### Limits and stop gate

- Real Chrome manual verification remains pending. Synthetic extension previews and headless tests do not verify actual side-panel opening/closure, every live website or real provider responses.
- Three preexisting TypeScript errors and four distinct preexisting browser failures (one overlay and three selected-text cases) were independently reproduced on untouched HEAD and remain unresolved outside this visual scope. No backend tests were run.

**STOP: AWAITING USER VERIFICATION.** Do not start a later milestone until the user explicitly verifies this redesign and approves further work. No commit, push, deployment or publication is authorized.

## Rive character and Motion playground, stage 1 — 27 October 2026

Status: **CHARACTER DESIGN AND IDLE APPROVED** by the user on 27 October 2026 with “yes , i approve character design and idle direction”. This supersedes the design/idle stop gate below; it does not approve extension integration. The user requested Rive CLI, Motion for React, a standalone character/playground before extension integration, and approvals between design and subsequent expressions. This entry covers the original character design, idle/gaze rig and isolated movement prototype only. The existing extension remains unchanged.

### Delivered scope

- Installed official Rive CLI 1.8.0 at `~/.rive/bin/rive`; read its official getting-started/agent instructions, generated `character/AGENTS.md`, relevant `rive docs` and object schemas. Opened the native live-reload preview and rendered idle, blink, gaze and static poses with CLI. No account login, upload, signing, publication or shell-profile change.
- Added `prototypes/robot-playground/character/scene.rml`: an original rounded yellow/graphite robot, two large mechanical eye housings, warm lenses, ivory repair plate and small body. The script-free `public/robot.riv` is **4,235 bytes**. `Buddy` state machine transitions between an eight-second `Idle` timeline and a reduced-motion `Still` pose. Idle includes breathing, gentle head movement and staggered blinks; Rive data bindings smooth bounded gaze.
- Added a separate React/Motion playground with character study, floating buddy/ask card, and sample sidebar perch. Motion handles floating, spring click nudge, hover/press feedback, bounded dragging, keyboard movement/Home reset, and interruptible context/panel movement. Rive handles the internal character. The robot's body is masked behind the sample sidebar edge; focusing its local composer redirects gaze toward the writing area without reading text.
- Added dynamic reduced-motion preference handling, a manual reduced-motion toggle, pause, visible keyboard focus, and hidden/offscreen suspension. Pointer/drag updates use refs, Rive properties and Motion values rather than per-frame React state.
- Dependencies are isolated under the prototype's npm manifest/lockfile: Motion 14.6.0, React Rive 4.37.1 and its matching Canvas 2.45.1. A first attempt using latest standalone Canvas 2.47.1 produced an incompatible WASM import error; aligning the versions resolved it. WASM is served locally, with CDN fallback disabled. The full runtime is substantially larger than the character: final build reports 2,128.71 KB WASM and 667.89 KB JS before gzip; production integration must evaluate/lazy-load that cost.
- `README.md` documents preview, edits, compile/inspect/export, reproducible pose captures, the future expression sequence, manual verification and Chrome side-panel boundaries. Native Chrome panel chrome cannot be animated like an in-page HTML panel; the current perch demonstrates composition inside the panel only.

### Actual evidence

| Exact command/check | Result |
| --- | --- |
| `npm --prefix prototypes/robot-playground run character` | Exit 0; CLI verify: 0 errors/0 warnings; parsed `inspect --summary`: no problems; exported/copied 4,235-byte binary |
| `~/.rive/bin/rive prototypes/robot-playground/character --screenshot=/tmp/clickpilot-rive-idle.png --advance=1` | Exit 0 after allowing local macOS graphics; image inspected |
| Same CLI capture with `--screenshot=/tmp/clickpilot-rive-blink.png --advance=144` | Exit 0; mechanical blink pose inspected |
| Same CLI capture with `--screenshot=/tmp/clickpilot-rive-gaze.png --data=lookX=8 --data=lookY=-7 --advance=60` | Exit 0; bounded upward/right gaze inspected |
| Same CLI capture with `--screenshot=/tmp/clickpilot-rive-still.png --data=reduceMotion=true --advance=145` | Exit 0; static open-eye pose inspected |
| `npm --prefix prototypes/robot-playground run typecheck` | Exit 0 |
| `corepack pnpm exec eslint --config prototypes/robot-playground/eslint.config.mjs prototypes/robot-playground/src prototypes/robot-playground/scripts` | Exit 0 |
| `npm --prefix prototypes/robot-playground run build` | Exit 0; dependency `use client` directive and >500 KB chunk warnings remain; log `/tmp/clickpilot-robot-final-build.log` |
| `node /tmp/clickpilot-robot-check.cjs` with local browser access | Final exit 0: drag/keyboard reset and rapid context switching passed; no page/console errors, no external requests, no horizontal overflow at 390px, identical reduced-motion canvas captures 2.8 seconds apart. Log `/tmp/clickpilot-robot-final-browser.log` |
| `git diff --check` | Exit 0 before handoff; checked again after documentation |
| Backend and extension regression tests | NOT RUN: isolated prototype; user requested no backend tests; extension runtime/source untouched |

Browser verification caught and corrected dynamic reduced-motion handling: the installed Motion hook reads the initial preference, so the playground now subscribes to media-query changes and forwards them to Rive. Initial capture automation also waited indefinitely for a continuously floating element to become stationary; using viewport captures and an explicit pointer click resolved that harness issue. One extended drag/Home run reported a positional mismatch; an immediate rerun of the same source/check passed without a code change. Manual drag/reset verification remains required. A later rerun initially found the local server had stopped between turns; restarting it allowed the final passing run. No automatic approval rejection occurred.

Native and browser captures were visually inspected. Browser captures in `/tmp/clickpilot-robot-review/`: `portrait.png`, `gaze-left.png`, `gaze-right.png`, `ask.png`, `sidebar.png`, `sidebar-dark.png`, `mobile.png`, `reduced-a.png`, `reduced-b.png`. The final 390px capture follows rapid context switching and may show an empty local composer; the earlier supplied mobile capture also covered entered text. A fresh Impeccable finish reviewer returned **ship to user verification** with no material findings in this slice; a separate documentation handoff found no factual corrections needed. Context/detector tooling could not launch because its engine/cache was unavailable; no detector pass is claimed. These captures/checks establish prototype behavior, not real Chrome extension integration or subjective animation approval.

### Manual Chrome verification and approval

1. Run `npm --prefix prototypes/robot-playground run dev` from the repository root, then open `http://127.0.0.1:5176` in Chrome. Expect the yellow/graphite character to load and breathe/blink gently. Keep DevTools Console and Network open: runtime errors, missing assets or an external request fail this prototype check.
2. Move the pointer around the face. Expect smooth bounded eye tracking. Drag/release it, try arrow keys while focused, and press Home or Reset position during movement. Expect a usable reset, no stuck drag and no card opening merely from a drag. Click the character to inspect the small spring nudge.
3. Select Floating buddy and click it to open the sample ask card. Focus/type in its composer: eyes should turn toward the writing area; no request is sent. This first slice does not yet contain the separate curiosity expression or caret tracking.
4. Choose Open workspace or Sidebar perch. Expect the robot to move to the panel edge and its lower body to disappear behind it. Close and reopen quickly, switch views during motion and reset: expect one robot, one relevant panel and no stuck surfaces. The real Chrome sidebar is not changed in this stage.
5. Try Light/Dark stage, narrow the Chrome window and zoom. Expect readable labels, visible focus and no clipped composer or horizontal overflow. Toggle Reduce motion and change the system preference while the page remains open: internal character motion and spatial animation should settle. Test Pause/Resume separately, switch tabs, and scroll the stage out of view.
6. For the native character preview/edit loop, run `~/.rive/bin/rive prototypes/robot-playground/character`. Follow the prototype README to change the RML and run `npm --prefix prototypes/robot-playground run character` before reloading the browser asset. Approve or correct the silhouette, eye design, materials, idle pacing and sidebar perch before the next expression pass.

### Deferred work and stop gate

Listening/typing curiosity, happy cursor-proximity and click expressions, thinking, confused, surprised, sleepy and error are **not implemented yet**. The prototype currently supplies gaze and a Motion nudge, not those richer emotional states. Add and review expressions incrementally after design/idle approval. Real extension integration follows a separate approval after character and movement review. No voice, screenshots, AI feature, backend change, extension permission, commit, push, deployment or publication was added.

**STOP: AWAITING USER VERIFICATION.** This is the user's requested design/idle checkpoint; do not advance to further expressions or integration until explicitly approved.

## Rive character, stage 2 — expressions and attention — 27 October 2026

Status: **EXPRESSIONS AND TIMING APPROVED** by the user on 27 October 2026 with “good , i approve the expressions and timinig continue”. This supersedes the expression stop gate below and authorizes the integration stage recorded next. The user approved the character design and idle direction with “yes , i approve character design and idle direction”. That approval permits this previously requested expression pass; real extension integration still requires a separate approval.

### What changed

- Added Listening, Thinking, Happy, Confused, Surprised, Sleepy and Error to the existing `Buddy` Rive machine, preserving the approved character and idle. There are eight expression states plus Still. A numeric view-model property `expression` selects 0–7; reduced-motion conditions override it. Early-exit blends allow interruption. Each timeline resets the same pose properties so interrupted eye scales/tilts cannot persist.
- Listening leans toward the composer with open eyes and a blink; Thinking looks upward and searches side-to-side; Happy anticipates/rebounds into squinted eyes; Confused narrows one eye and tilts; Surprised widens the lenses and recoils; Sleepy has heavy lids/long blinks with the Motion float stopped; Error briefly recoils with concern and settles calmly. Listening/Thinking/Sleepy loop. Happy/Confused/Surprised/Error play once and hold for inspection. Select Idle then the expression to replay a short reaction.
- Automatic mode reacts to cursor proximity with hysteresis, returning to idle on departure. Click produces 420 ms of surprise, then 1.3 seconds of happiness before current attention resumes. Composer focus selects Listening and looks toward its writing area; input events add a tiny gaze acknowledgment. No entered text or caret value is read. Blur restores automatic attention. Manual state, focus, context, pause and visibility changes clean up click timers; pointer frames continue to avoid React state updates.
- Added accessible preview buttons for all eight expressions and a toolbar that reports actual Rive state-change events. Preview states do not start a task or imply an actual AI result/error. The existing floating/dragging/spring/ask/sidebar prototype remains isolated. No extension/runtime/API/permission/dependency changes.
- Added a reproducible browser workflow check at `prototypes/robot-playground/scripts/check-expressions.mjs`, using the repository's existing Playwright installation. Updated the prototype README with per-expression playback, native preview/render/edit commands, runtime mapping, manual steps and the next approval gate. The script-free character now exports to **10,667 bytes**.

### Actual validation

| Exact command/check | Result |
| --- | --- |
| `npm --prefix prototypes/robot-playground run character` | Exit 0; CLI verify 0 errors/0 warnings, parsed inspect summary no problems; exported/copied 10,667 bytes |
| `~/.rive/bin/rive prototypes/robot-playground/character --verify` and `~/.rive/bin/rive inspect prototypes/robot-playground/character --summary` | Exit 0; 9 animation states/timelines, 1 machine, 0 inspect problems |
| CLI native capture command below for expression values 0–7 | All 8 exited 0 and images were inspected. Values 0/1/2/3/4/6 rendered at frame 55, Surprised (5) at frame 18, Error (7) at frame 26 |
| `npm --prefix prototypes/robot-playground run typecheck` | Exit 0 on final source; also included in build |
| `corepack pnpm exec eslint --config prototypes/robot-playground/eslint.config.mjs prototypes/robot-playground/src prototypes/robot-playground/scripts` | Exit 0 on final source |
| `npm --prefix prototypes/robot-playground run build` | Exit 0; log `/tmp/clickpilot-expressions-build.log`. Existing dependency `use client` and bundle-size warnings remain. WASM 2,128.71 KB; JS 670.02 KB before gzip |
| `CLICKPILOT_CAPTURE_DIR=/tmp/clickpilot-expression-review npm --prefix prototypes/robot-playground run check:browser` | Exit 0; all 8 real Rive state changes, approach/departure, surprise→happy, ask/sidebar typing, cancellation by manual expression, dynamic reduced-motion override/static canvas, pause/resume, 390px overflow, drag/Home and single canvas passed; **zero console/page errors and zero external requests** |
| `git diff --check` | Exit 0; rechecked after documentation |
| Backend / extension regression tests | NOT RUN: user requested no backend tests; extension source/runtime untouched |

Native capture pattern, substituting the expression number/name and frame above:

```sh
~/.rive/bin/rive prototypes/robot-playground/character --screenshot=/tmp/clickpilot-expression-review/happy.png --data=expression=3 --advance=55
```

The first browser attempts stopped on ambiguous composer locators while ask/sidebar exit/entrance overlapped. The checker now uses each composer's accessible name; this required no UI behavior change. An initial standalone typecheck caught narrowing of the optional state-change event name, and lint caught browser globals inside the check's page callback; both were corrected before the final passing checks. The dev-server start found port 5176 already occupied by the existing playground; that server was reused. No automatic approval rejection occurred.

Native captures: `/tmp/clickpilot-expression-review/{idle,listening,thinking,happy,confused,surprised,sleepy,error}.png`. Browser captures in the same directory: `web-idle.png`, `web-listening.png`, `web-thinking.png`, `web-happy.png`, `web-confused.png`, `web-surprised.png`, `web-sleepy.png`, `web-error.png`, `web-typing.png`, `web-sidebar.png`, `web-mobile.png`, `reduced-a.png`, `reduced-b.png`. Inspected all eight native poses and desktop Happy/Surprised, typing, sidebar and narrow dark captures. A fresh finish reviewer independently inspected those captures/source and returned **ship** at standalone prototype scope, with no material findings. No detector pass is claimed: its engine/cache remained unavailable from the preceding stage. Static captures and scripted checks do not establish subjective animation quality or real Chrome side-panel integration.

### Manual Chrome verification

1. Open `http://127.0.0.1:5176/` (or run `npm --prefix prototypes/robot-playground run dev` if needed). In Automatic, approach/depart the face and move around it: expect happy/idle transitions, smooth gaze within the lenses and no repeated happy entrance while lingering near the threshold. Console errors or external network requests fail verification.
2. Click for surprise followed by happiness. Try each named preview; select Idle then the desired state to replay a short reaction. Compare personality/intensity/timing against the table in the README. Error should recover calmly; Sleepy should reduce movement. Wrong toolbar state, stale pose or a distracting repeated recoil fails verification.
3. In Automatic/Floating buddy, open the ask card and focus/type. Expect curious Listening and gaze toward the writing area. Blur it, then Open workspace and repeat: expect attentive eyes over the panel edge. No request is submitted. Select Thinking during a click reaction and wait two seconds: it must remain Thinking rather than being overwritten by a stale happy timer.
4. Change views rapidly, drag/release, press arrow keys/Home while focused, reset mid-movement and close/reopen panels. Expect one robot, bounded movement, reliable reset and no accidental card opening after drag. Check light/dark, a narrow window and browser zoom for readable controls, visible focus and contained composers.
5. Enable reduced motion and change the system preference while open: every preview should settle to Still. Select an expression while paused, then resume: expect that selected expression. Check Pause/Resume separately and switch tabs/scroll out of view to verify suspension. Motion continuing in the still pose fails verification.

**STOP: AWAITING USER VERIFICATION.** Approve expression personality, intensity and timing before the separate extension-integration stage. No voice, screenshot feature, AI feature, commit, push, deployment or publication was introduced.

## Animated companion, stage 3 — extension integration — 27 October 2026

Status: **AWAITING USER VERIFICATION** in Chrome. The user approved expressions/timing with “good , i approve the expressions and timinig continue”, completing stage 2 and authorizing this integration. No later milestone, commit, push, deployment or publication is authorized.

### Delivered behavior and boundaries

- Integrated the approved yellow/graphite Rive character into the floating buddy/ask experience and the real React sidebar. The sidebar robot peeks over its header edge, looks toward the composer, and uses existing task states for expressions. Small header/message avatars use the same character's static poster, avoiding a canvas per message. The approved standalone playground remains available for editing/review.
- Rive controls internal expressions/gaze; Motion controls float, click bounce, native spring positioning, bounded drag momentum, ask-card entrance/exit and sidebar content entrance. The launcher is now 80px so the mechanical eyes remain legible; existing clamp tests were adjusted to that actual size. Original native DOM controls, trusted-event checks, shared task ownership, consent, guidance, selected-text behavior and recovery are preserved. Input focus/event geometry informs attention without reading additional text or caret values.
- Automatic cursor approach/departure produces Happy/Idle with hysteresis. Click produces the approved Surprise→Happy reaction, interrupted by typing/task changes. Requests show Thinking; guidance shows Listening and floating gaze toward the target; answers show Happy; clarification shows Confused; pause/recovery shows Sleepy; errors briefly express concern then settle. A focused new-question composer can show Listening from paused/clarification states. Reduced motion selects Still and removes float, bounce, spring travel and drag momentum.
- Opening the sidebar docks the page buddy toward the right edge. Clicking/dragging it restores normal local interaction. Chrome owns its outer side-panel frame/width/closure; only extension content and the page buddy are animated. There is no new page-action automation.
- Added pinned extension dependencies Motion 14.6.0, Rive React 4.37.1 and its matching Canvas 2.45.1, as explicitly requested/approved. Build/typecheck prepare local copies of the approved 10,667-byte character and installed WASM; generated copies are ignored. CDN fallback is disabled. Final unpacked build is about **3.62 MB**, including **2.13 MB WASM**, a **516.27 KB content script**, **521.84 KB sidebar JS** and shared **278.57 KB Rive JS**. These are raw sizes; the runtime cost is larger than the character asset alone.
- The direct content-script Rive renderer worked on ordinary pages but failed WASM compilation under a strict page CSP. A minimal isolated-world WASM compilation reproduced the same failure. The final floating artwork therefore uses a packaged extension-origin `robot.html` renderer with a nonce/source-bound private MessageChannel. It accepts only bounded numeric expression/gaze and boolean visibility/motion flags. Extra fields, page text and task commands are rejected; no extension task/service IPC is added to the frame. Native controls remain outside it. Exposing only `robot.html` and enabling local WASM in extension CSP adds **no browser permission or host permission** and does not modify website CSP.
- Hidden/offscreen graphics suspend; unload closes the channel/runtime; back/forward cached frames pause and resume. The static poster stays visible on load/failure, and ask controls work independently. Drag release momentum decays after a held pause; tiny viewport dismissal resets the ask surface. Documentation: `docs/companion-animation.md`, README and prototype README. No voice, screenshot feature, new AI feature or backend change.

### Exact check evidence

| Command/check | Actual result |
| --- | --- |
| `corepack pnpm --filter @clickpilot/extension build` | Final exit 0. Output `apps/extension/.output/chrome-mv3`; log `/tmp/clickpilot-integration-build.log`. >500 KB chunk warning remains |
| `corepack pnpm exec eslint apps/extension` | Final exit 0; `/tmp/clickpilot-integration-lint.log` |
| `corepack pnpm --filter @clickpilot/extension test` | Exit 0; **126 tests in 14 files passed**. Includes two graphics-channel boundary tests; `/tmp/clickpilot-integration-unit.log` |
| `corepack pnpm --filter @clickpilot/extension typecheck` | Final exit 2; exactly three preexisting TS2339 errors in unchanged `src/features/session/background-tasks.ts`: line 246 (`type`), line 248 (`tabId`, `snapshot`). No new type errors. `/tmp/clickpilot-integration-types.log` |
| `corepack pnpm exec playwright test tests/e2e/buddy.spec.ts --workers=1` | Final exit 0; **8/8 passed**, 32.8 seconds, on final build. `/tmp/clickpilot-integration-final-buddy.log` |
| `corepack pnpm exec playwright test tests/e2e/buddy.spec.ts tests/e2e/overlay.spec.ts --workers=1` | Exit 1; **43/44 passed**. Sole failure: the previously baseline-reproduced `overlay.spec.ts:241` panel-disconnection case leaves one overlay instead of zero. All 8 buddy workflows passed. `/tmp/clickpilot-integration-final-browser.log` |
| `corepack pnpm exec playwright test tests/e2e/buddy.spec.ts --grep 'packaged Rive\|failed character' --workers=1` | Exit 0; **2/2 passed** before the final full buddy rerun. `/tmp/clickpilot-integration-character-browser.log` |
| Manifest/output inspection | Browser/host permission lists unchanged; CSP enables packaged WASM; only `robot.html` exposed to HTTP/HTTPS; `.riv`/WASM packaged locally |
| `git diff --check` | Exit 0; repeated after final documentation |
| Backend tests | **NOT RUN**, as requested |

The three type errors and panel-disconnection failure were independently reproduced on untouched HEAD in the earlier visual-redesign entry. They recur here; the worker/overlay modules remain unchanged by this integration. Typecheck and the combined browser run are not reported as passing. The final buddy-only run followed the last drag-release/tiny-viewport/bfcache adjustments; the broader overlay run preceded those UI-only adjustments. The three preexisting selected-text failures recorded earlier were not rerun as a separate suite; the existing buddy-selected-text workflow passed.

Browser coverage includes local open/no-request behavior, shared answer/sidebar continuation, Stop/consent/late reply rejection, worker restart, navigation and tab/origin isolation, drag/hide/non-blocking page interaction, selected-text assistance, actual Rive loading on a strict-CSP fixture, cursor Happy/Idle, click Surprise, typing Listening, request Thinking, stopped Sleepy, sidebar Listening, dynamic Still and an explicitly intercepted/blocked character request with usable poster/form fallback. New graphics packets reject unsupported expressions, non-finite/out-of-range gaze, extra content and task commands. Browser workflows use local synthetic fixtures and mocked responses, not a real provider or backend test suite.

### Visual review

Inspected actual integrated Chrome captures `/tmp/clickpilot-integrated-ask.png` (1100×800), `/tmp/clickpilot-integrated-sidebar-light.png` (360×800), and `/tmp/clickpilot-integrated-sidebar-dark.png` (260×800). Rive is loaded, the writing-area focus is visible, the perch hides the lower body, controls/composers remain contained, and the narrow page has no horizontal overflow. The final buddy run regenerated those captures. A fresh finish reviewer inspected the captures and production source and returned **ship to user verification**, with no material findings. A separate documentation handoff confirmed facts/commands; a stale prototype intro was corrected. No detector pass is claimed because the skill engine/cache remained unavailable. Static captures do not establish subjective pacing or actual Chrome side-panel lifecycle behavior.

### Numbered manual Chrome verification

1. Reload ClickPilot at `chrome://extensions` using `apps/extension/.output/chrome-mv3`. Activate it on a permitted normal page. Expect the yellow/graphite buddy without a new permission prompt. Keep Console/Network open: repeated asset failures, runtime exceptions or CDN requests fail verification. A momentary poster during startup is expected; deliberately blocked assets should leave usable controls.
2. Approach/depart the robot and move around its face: expect smooth gaze, a happy approach reaction and idle on departure. Click to open/close the ask card: expect surprise→happy, a small bounce and smooth card transitions. Focus/type: expect curious attention toward the writing area. Hover, focus and typing alone must send no provider request.
3. Drag quickly and slowly, hold before release, grab during a spring, press Alt+Arrow keys and Home while focused, resize/zoom, and use Escape/Close/Hide. Expect bounded positioning, a reliable reset, no stale momentum after holding and no accidental Ask from a drag. Ordinary webpage controls must remain usable.
4. With existing sharing consent/service configured, explicitly ask a synthetic/public question. Expect Thinking, then the existing answer or guidance. During guidance expect attentive gaze toward the highlighted element; follow each page action yourself. Stop/Retry/Continue/Done must retain existing behavior. No automatic click, typing, submission or navigation is allowed.
5. Open the real Chrome sidebar from the ask card. Expect the page buddy to move toward the edge, the same conversation/task in the workspace, and the robot peeking over its header. Type a new question and check curiosity; try More options/Settings/text assistance and return. Close/reopen Chrome's panel mid-task: expect existing task retention and usable controls. Chrome's outer frame opens/closes under browser control.
6. Repeat in light/dark appearance, a narrow sidebar and browser zoom; check long content/settings, keyboard focus, selection assistance and target alignment while scrolling. Expect readable surfaces and contained composers. The synthetic panel HTML captures are not proof of actual Chrome panel frame behavior.
7. Change the system reduced-motion preference while open: expect Still with no floating, bounce, spring travel or drag momentum, while controls still work. Switch tabs, scroll out of view, navigate back/forward and reactivate/reload: expect suspension/cleanup and recovery without duplicate/frozen characters. Back/forward-cache handling especially still needs real-browser manual verification.

**STOP: AWAITING USER VERIFICATION.** Integration is built and reviewable. Do not start the next milestone until the user verifies it in Chrome and approves further work.

## Interaction sounds and reply boings — 27 October 2026

Status: **AWAITING USER VERIFICATION** for audible timing/volume. The user authorized the named local interaction sounds, explicitly waived unit tests, and then requested `boing-1` for normal replies and `boing-2` for selected-text answers. This does not imply manual verification of the preceding UI milestone.

### Implementation

- Bundled exactly nine supplied WAVs from root `sounds/`: agent launch/close, clicky text open/close/send/selection, sidebar and boing-1/boing-2. Build preparation copies originals unchanged into ignored `apps/extension/public/sounds/`, then WXT packages them. No new library, remote audio or microphone feature.
- Added typed `playSound()` / cue validation in `src/lib/sounds.ts`. Buddy/card/form handlers trigger cues only at the corresponding existing action; invalid/disabled submissions remain silent. First show and show after Hide play launch; card reopen/repeated toolbar activation do not replay launch. Explicit card close, bot toggle-close and Escape play the card-close cue. Hide uses agent-close.
- A new assistant-message ID observer in the shared task owner plays boing-1 for normal replies and boing-2 for selected-text replies. It ignores initial restored history and does not replay when a reply appears in both views or history is reopened. Only the cue name reaches the audio player; no message text is transmitted.
- Added the **offscreen** permission and a minimal packaged `audio.html` player with the `AUDIO_PLAYBACK` reason, after explaining why the permission was needed. Chrome blocked cold-launch playback inside the webpage character frame (`NotAllowedError`); offscreen playback succeeded before page interaction and survives UI closure. The player is lazy, validated, local, 50% volume and replaces the previous clip to avoid overlap. Chrome retires the document after 30 seconds of audio inactivity. No extra website access/host permission, persistent keepalive or graphics-channel change.
- Chrome's real `sidePanel.onOpened` event plays sidebar (Chrome 141+, with older-version document-open fallback); `onClosed` plays agent-close (Chrome 142+). Chrome actually returned `/sidepanel.html`, so paths are normalized before matching. Closing the entire browser is outside a surviving playback context. Source/usage/mappings are documented in `docs/interaction-sounds.md`.

### Actual checks

| Exact command/check | Result |
| --- | --- |
| `corepack pnpm --filter @clickpilot/extension build` | Final exit 0; all nine WAVs and audio page packaged. Unpacked build about 4.78 MB; existing >500 KB chunk warning remains. `/tmp/clickpilot-sounds-build.log` |
| `corepack pnpm exec eslint apps/extension` | Final exit 0; `/tmp/clickpilot-sounds-lint.log` |
| `corepack pnpm --filter @clickpilot/extension typecheck` | Final exit 2; same three preexisting TS2339 errors, now shifted to background-tasks.ts:254 (`type`) and :256 (`tabId`, `snapshot`). No new type errors. `/tmp/clickpilot-sounds-types.log` |
| `node /tmp/clickpilot-sounds-smoke.mjs` | Final exit 0 on final build: actual cold-launch audio advanced to 0.756 seconds; all nine requested clips successfully started; real Chrome sidebar opened/closed and both native event cues played; Hide/relaunch worked; boing-1 and boing-2 played exactly once each, with no replay on opening the sidebar; one launch per activation. `/tmp/clickpilot-sounds-smoke.log` |
| `git diff --check` | Exit 0; rechecked after documentation |
| Unit tests / backend tests | **NOT RUN** for this task, as requested; no test files added or changed for sounds |

The temporary browser smoke check used a local static page and intercepted synthetic normal/selected-text replies, plus the actual packaged extension and Chrome sidebar. It observed successful `HTMLMediaElement.play()` promises and cold-launch playback progress; it did not listen through human speakers. Early checks identified the cold-launch autoplay block and the leading slash in real sidebar event paths; both were fixed before the final passing check. An initial smoke run also needed to re-enable the existing selected-text mode after a normal guidance request; only the temporary check changed for that lifecycle rule. No automatic approval rejection occurred.

### Manual Chrome verification

1. Reload `apps/extension/.output/chrome-mv3` at `chrome://extensions` with the new audio-only offscreen permission. Activate ClickPilot on an ordinary permitted page: expect agent-launch once. Hide and reactivate: expect close then launch. Reopening the ask card alone must not replay launch.
2. Open/close the bot's ask card using the bot, close button and Escape: expect the corresponding clicky open/close clips. Send a valid public question with existing consent/service configured: expect clicky-text-send and then one boing-1 for a new normal reply. Invalid/disabled sends must not produce a send cue.
3. Enable/re-enable selected-text assistance if needed, select public text and submit its question: expect clicky-text-selection then one boing-2. Merely selecting text must not play the send cue. Opening the same answer in the sidebar must not replay the boing.
4. Open the actual Chrome sidebar: expect sidebar.wav; close its built-in panel control: expect agent-close on Chrome 142+. Check that a close cue finishes and that volume/timing are comfortable. Rapid actions may replace the preceding clip rather than overlap. Record missing, doubled or overly loud cues before approving this addition.

**STOP: AWAITING USER VERIFICATION.** No commit, push, deployment or publication was performed. No later milestone is authorized.

## Git handoff authorization — 27 October 2026

The user explicitly requested committing and pushing all current changes to `feature/redesign`. This authorizes the redesign/prototype/runtime/audio/source-asset/documentation commit and publication of that Git branch to the configured origin. It does not authorize deployment, a pull request merge, or a later implementation milestone, and does not change the manual Chrome verification status recorded above. No additional tests were run for this source-control-only handoff; the prior check evidence and known limitations remain applicable. The resulting commit/push confirmation is reported in the conversation.

## Global activation, local text selection and menu continuation repair — 28 October 2026

Status: **AWAITING USER VERIFICATION**. The user explicitly requested all three related fixes. This does not imply verification of previous UI/audio work. No commit, push, deploy or publish was performed.

### Investigation and changes

- The old toolbar handler authorized only the clicked tab and its origin. Global ON now requests optional `http://*/*` and `https://*/*` host access in the toolbar gesture, checks Chrome's actual grant and scripting access, and activates currently open supported tabs. Tab events activate subsequent supported documents without keeping the service worker alive. Global OFF serializes with tab events, cancels tasks and removes buddy/selection/overlay UI. A single session-scoped global flag survives worker suspension; it resets to OFF after the browser session ends. Tasks and recovery records remain per-tab. Restricted browser/store pages and the existing sensitive-page exclusion are skipped.
- Restored back/forward-cache documents hide their old UI on page exit and ask the worker to recheck global state and access before showing it again. Actual cache use still needs Chrome verification.
- A denied all-site request keeps the current toolbar gesture's temporary `activeTab` route, shows the TAB badge and explains the restriction in the buddy. When access is lost, local UI/listeners are removed and an interrupted task is paused; revoked all-site permission turns global mode off. A reconnect checks scripting access again. Permission records are not themselves authority. Browser host permission is separate from the existing two AI-sharing consents; neither activation nor local selection initiates a model call.
- Reused the 7A selection implementation. Guidance, Stop, Done, New chat, sidebar closure and worker disconnect no longer leave selection disabled. Switching tabs cancels the current selection/request and removes its bubble while retaining the listener for the next selection; actual deactivation/access loss removes the listener. A valid unsent selection draft may rebind in the same document after worker restart; an interrupted request is cancelled rather than replayed. The buddy moves away from a selection bubble and collapses its card when the bubble appears. Existing user-gesture, consent, range, sensitive-content and result checks remain.
- The observed YouTube error is generated *before* the next snapshot/provider call: the controller received either no eligible control change or a failed optional objective check. It is not the distinct observation-timeout or stale-request message. A pre-fix regression reproduced the first case: on a crowded page, a newly opened focusable custom control without one of the original roles was excluded from extraction, so it could not contribute to a changed inventory. Extraction now includes keyboard-focusable custom controls and reserves popup slots before the 150-element cap. The regression passes with a fresh snapshot and the original goal.
- A separate verified grounding gap was that Gemini received no `aria-expanded` state yet could propose `target_expanded`. The sanitized control contract now includes an optional observed boolean, and the existing prompt says to suggest this objective only when the target exposes `expanded: false`. The checker still requires the exact target's false-to-true state; a failed check still pauses and is not silently discarded. Recovery text now distinguishes failed expansion/disappearance checks from no eligible control change. Manual continuation is explicitly labelled and remains user-confirmed.
- The trace still requires a matching trusted target click and current session/request/page/snapshot/target identity. Pointer-down/keyboard preparation captures the before inventory, mutations plus 100 ms sampling wait for a 400 ms quiet period within the 5 s observation bound, and the controller retains its 1.5 s timeout grace and stale-result guards. A continuing action with an eligible settled change and no failed objective takes a fresh settled snapshot, retains the original goal and bounded prior-step status, and respects `nextStep`. A click, an unverified change, a retry or a model response never marks task completion. No YouTube-specific selector was added.
- The signed-in YouTube DOM and its actual Gemini result were not available to inspect. The reproduced extraction defect and missing expansion evidence are real failure paths, but they do not establish which one caused the user's particular intermittent incident. The new recovery reason and the live Chrome check below are needed if it recurs. Public/synthetic fixtures and mocked API responses were used; no real Gemini call was made during this repair.
- Corrected the debug inspection result discriminator from `PAGE_SNAPSHOT` to the actual `INSPECTION_RESULT`; this also fixes three pre-existing TypeScript errors and restores panel-owned debug-overlay cleanup. No new dependency, screenshot feature, autonomous website action or background keepalive was introduced.

### Checks

| Exact command/check | Actual result |
| --- | --- |
| `corepack pnpm lint` | Exit 0 on final source. Log: `/tmp/clickpilot-issues-lint.log` |
| `corepack pnpm typecheck` | Exit 0 on final source, including the formerly failing debug inspection types. Log: `/tmp/clickpilot-issues-types.log` |
| `corepack pnpm test` | Exit 0 on final source: **92 API and 129 extension unit tests passed**. Log: `/tmp/clickpilot-issues-unit.log` |
| `WRANGLER_LOG_PATH=/tmp/clickpilot-issues-wrangler.log corepack pnpm build` | Exit 0 on final source; extension output is `apps/extension/.output/chrome-mv3`, and API build is a Wrangler dry run. The existing >500 kB chunk warning remains. Log: `/tmp/clickpilot-issues-build.log` |
| `corepack pnpm exec playwright test tests/e2e/buddy.spec.ts --workers=1 --output=/tmp/clickpilot-issues-final-buddy-results` | Exit 0 on final source: **13/13 passed**, including global ON/OFF, a pending-request abort, existing/new tabs, back/forward navigation, restricted page, isolation, local draft recovery, and simulated denial. Log: `/tmp/clickpilot-issues-final-buddy.log` |
| Focused combined Chromium command below | Exit 1 on final source: **36 passed, 1 failed, 8 skipped**. The buddy drag/Hide case failed once when CDP could not get the Hide button's box after a drag; the separate 13/13 buddy rerun above passed that same case and the eight skipped cases. The 36 passes include all selected guidance/verification, cross-origin, overlay navigation and selected-text cancellation cases. Log: `/tmp/clickpilot-issues-final.log` |
| Earlier broader Chromium command below | Exit 1 before the final back/forward change: **88 passed, 1 failed**. The failed cross-origin test used an obsolete sidebar button label; its assertions were updated for the current UI/per-tab ownership, and it passed both its isolated rerun and the final focused combined run. Log: `/tmp/clickpilot-issues-verified.log` |
| Production manifest inspection | Confirmed the loopback host stays required; HTTP/HTTPS all-site hosts are declared only in `optional_host_permissions`. No static content script is registered. |
| `git diff --check` | Exit 0 after this record was completed. |

Final focused combined command, exactly as run:

```sh
corepack pnpm exec playwright test tests/e2e/buddy.spec.ts tests/e2e/assistant.spec.ts tests/e2e/text-assistant.spec.ts tests/e2e/overlay.spec.ts --grep 'buddy.spec.ts|popup continuation|no-change waits|failed-check waits|observation cleanup|already-expanded|disappearing target|final guidance|6B cross-origin requires toolbar activation|selection completes|pending text cancellation|closing the sidebar leaves|toolbar activation and specific text consent|overlay.spec.ts.*(navigation|panel)' --workers=1 --output=/tmp/clickpilot-issues-final-results
```

Earlier broader command, exactly as run:

```sh
corepack pnpm exec playwright test tests/e2e/buddy.spec.ts tests/e2e/text-assistant.spec.ts tests/e2e/overlay.spec.ts tests/e2e/assistant.spec.ts --grep 'buddy.spec.ts|overlay.spec.ts|selection completes|toolbar activation|script-only|viewport clamping|geometry loss|sensitive, editable|MOCK text result|pending text cancellation|nested scroll|closing the sidebar leaves|popup continuation|no-change waits|failed-check waits|observation cleanup|already-expanded|disappearing target|final guidance' --workers=1 --output=/tmp/clickpilot-issues-verified-results
```

The 45 focused scenarios are covered across the 36 passing cases and the separate 13/13 buddy run (the runs overlap). The broader earlier run exercised the complete overlay suite and selected text privacy, hostile-result, layout and cancellation cases. A pre-fix custom-control regression failed before implementation; the same unit and browser regression now pass. One earlier drag/Hide test failed under browser-run timing and passed on a separate rerun; real interaction remains a manual check. The complete `test:e2e` suite was not run. An initial sandboxed browser attempt could not bind localhost; the local browser checks used approved sandbox escalation. A concurrent retry briefly lost the shared fixture server and was rerun sequentially. These intermediate failures are not counted as passes.

Headless Chromium cannot operate the native optional-permission dialog. The denial test stubs the request as denied; global tests use a temporary copy of the manifest with test-only host access already granted. The shipped manifest keeps the hosts optional. Browser tests use synthetic fixtures, local mock HTTP responses, forced worker termination and a panel HTML tab. They do not verify a native permission prompt, actual Chrome permission revocation, natural worker suspension, a guaranteed back/forward-cache hit, real Gemini, a signed-in YouTube account, or Chrome's actual sidebar lifecycle.

### Manual Chrome verification

1. Restart the local API Worker (`corepack pnpm dev:api`) so it accepts the updated optional `expanded` field and uses the updated Gemini instruction. At `chrome://extensions`, reload the unpacked `apps/extension/.output/chrome-mv3`. Open two ordinary public webpages and a restricted Chrome page. Check the extension's Errors and service-worker console for unexpected errors; if checking worker sleep, close DevTools afterward.
2. With all-site access not already granted, click the toolbar and **deny** Chrome's prompt. On a supported page expect the buddy, a TAB badge and an explanation that only the current tab is active. Another tab must not get a buddy. Select public webpage text with the sidebar closed: expect Ask ClickPilot; no provider request should occur from selection or drafting. If the prompt is not shown because access was previously granted, revoke the host grant in Chrome's extension site-access settings before testing denial.
3. Click the toolbar on the supported page and accept the optional all-site request. Expect ON and one buddy on each already-open supported tab. Open another webpage and navigate between supported origins and through Back/Forward: expect one buddy per supported page. Restricted Chrome and Web Store pages must not show one. Submit different public goals on two tabs with existing guidance consent enabled; switching back must retain each tab's own task rather than showing the other goal. No page should be clicked, typed into or navigated by ClickPilot.
4. Close the actual sidebar. Select normal public text, including after asking and stopping a guidance task and after switching away and back: expect one Ask ClickPilot bubble, with the buddy/card moved away if they would overlap. Selection and typing a question must cause no AI request. With selected-text sharing off, Ask must remain disabled; after enabling that separate consent, an explicit Ask may send the selected passage and question. Try Cancel, Escape, an input/editable field and sensitive fixture text: expect cleanup or no offer, as applicable.
5. While signed in to YouTube, ask **how to switch accounts** with webpage guidance consent and the local Worker configured. Click the highlighted profile control yourself. If Gemini signals a continuing step and the existing checks permit it, expect a new instruction and highlight for the visible **Switch account** control without re-entering the goal. A timeout, no change, a failed declared outcome or a final-step signal must remain honest; no success or automatic click is allowed. If the reported recovery recurs, record whether it says an expected target expansion/disappearance failed or no eligible control change was observed; do not share account text or private snapshots.
6. Click the toolbar again while global mode is ON, including once while a mock or real request is pending. Expect the buddy, selection bubble and highlight to disappear from every open tab; late replies must not restore them. Open a new supported tab and use Back/Forward: no buddy should return until re-enabled. Re-enable and revoke the optional host grant in Chrome's extension settings: expect global UI/listening to be removed and no further page sharing. Report any tab that retains interactive UI after access is lost.
7. Re-enable global mode, leave a supported tab idle with extension DevTools closed so Chrome can suspend the worker, then select public text and open the buddy. Expect local selection to remain available and the existing task to reconnect paused without a replayed request. Continue only by user action. Check normal website controls, dragging, the actual sidebar, page/extension consoles and Network for unexpected failures or unsolicited requests.

**STOP: AWAITING USER VERIFICATION.** The project's `AGENTS.md` requires manual verification and explicit approval before the next milestone.

## Global activation correction — 28 October 2026

Status: **VERIFIED by the user** on 28 October 2026. The user confirmed the text-selection and YouTube cases work, reported the global activation issue, and after the correction confirmed “everything is working how it should”. The user authorized committing and pushing the changes to `final-touchs`. No later milestone or deployment is authorized.

### Cause and correction

- The original global activation queue awaited every tab's response before it could process new-tab updates or another toolbar action. A deterministic Chromium regression held one tab's `SHOW_BUDDY` response open: before the fix, the newly opened website did not get a buddy and clicking the toolbar again left the first buddy visible. This reproduces both reported symptoms, although the particular stalled tab in the user's Chrome session was not inspected.
- Global ON/OFF state changes no longer wait for tab UI messages. Tab navigation work and temporary-access probes are isolated by tab. A delayed page cannot block another tab or the toolbar. Global OFF starts page cleanup without waiting on a slow storage operation or permission probe.
- Before showing or removing page UI, the content script checks the current activation and actual Chrome access with the worker. Late show/disable responses therefore cannot undo a newer toggle. In-memory revision checks prevent older asynchronous work from overwriting a newer state. The existing session-scoped global flag is still the authority after worker restart; no heartbeat or keepalive was added. Previous current-tab fallback grants are cleared on global OFF so they cannot silently revive it.
- The existing optional HTTP/HTTPS host request, denied-permission fallback, privacy/AI-consent checks, per-tab tasks and local 7A selection remain in place. No new browser permission, dependency, Gemini behavior or autonomous page action was added.

### Actual checks

| Exact command/check | Result |
| --- | --- |
| `corepack pnpm lint` | Exit 0 on final source; `/tmp/clickpilot-switch-lint-final.log` |
| `corepack pnpm typecheck` | Exit 0 on final source; `/tmp/clickpilot-switch-type-final.log` |
| `corepack pnpm test` | Exit 0 on final source: **92 API + 130 extension unit tests passed**, including a stalled access probe that does not block another tab; `/tmp/clickpilot-switch-unit-final.log` |
| `WRANGLER_LOG_PATH=/tmp/clickpilot-switch-wrangler-final.log corepack pnpm build` | Exit 0 on final source; the extension was rebuilt and the API Worker was built with Wrangler dry-run only. Existing >500 kB warning remains; `/tmp/clickpilot-switch-build-final.log` |
| Final focused Chromium command below | Exit 0 on the final build: **9/9 passed**. It includes a stalled tab blocking neither a new site nor OFF, late show/disable messages after toggles, fallback → global → OFF, independent tab state, worker restart, selection and custom-menu continuation; `/tmp/clickpilot-switch-final.log` |
| Earlier broader Chromium command below | Exit 0 on the preceding build: **33/33 passed**, covering all buddy workflows, popup continuation, cross-origin recovery and text selection/cancellation; `/tmp/clickpilot-switch-regression.log`. The final per-tab probe isolation and shutdown-order changes were followed by the final focused 9/9 and final workspace checks above. |
| Pre-fix `corepack pnpm exec playwright test tests/e2e/global-activation.spec.ts --workers=1 --output=/tmp/clickpilot-stalled-before-results` | Exit 1 as expected: both new-tab activation and global OFF assertions failed with one delayed tab; `/tmp/clickpilot-stalled-before.log`. The final focused run passes that same scenario. |
| `git diff --check` | Exit 0 after this record was completed. |

Final focused browser command, exactly as run:

```sh
corepack pnpm exec playwright test tests/e2e/global-activation.spec.ts tests/e2e/buddy.spec.ts tests/e2e/text-assistant.spec.ts tests/e2e/assistant.spec.ts --grep 'global-activation.spec.ts|global ON covers|global OFF aborts|unsent selected|denied optional|selection remains|selection completes|popup continuation .custom' --workers=1 --output=/tmp/clickpilot-switch-final-results
```

Earlier broader browser command, exactly as run:

```sh
corepack pnpm exec playwright test tests/e2e/global-activation.spec.ts tests/e2e/buddy.spec.ts tests/e2e/text-assistant.spec.ts tests/e2e/assistant.spec.ts --grep 'global-activation.spec.ts|buddy.spec.ts|selection completes|toolbar activation and specific text consent|pending text cancellation|closing the sidebar leaves|popup continuation|6B cross-origin requires toolbar activation' --workers=1 --output=/tmp/clickpilot-switch-regression-results
```

Browser tests use local fixtures, mocked responses and a disposable copy with all-site host access pregranted; fallback denial is simulated. They do not test the native Chrome permission prompt, actual permission revocation, natural worker sleep or the user's particular browser state. No real Gemini request, deployment, commit or push was made.

### Manual Chrome verification

1. Reload the unpacked extension at `chrome://extensions` from `apps/extension/.output/chrome-mv3`. Open two ordinary websites. Click the ClickPilot toolbar icon once and grant optional all-site access if Chrome asks. Expect the ON badge and one buddy on both supported pages. If a page is unsupported or blocked by Chrome, no buddy is expected there.
2. Open a new tab, navigate to an ordinary supported website, and wait for it to finish loading. Expect one buddy without another toolbar click. Open a second new website and switch between tabs; expect independent task state and no duplicate buddies. Chrome's built-in New Tab page is restricted and is not the requested website case.
3. Click the toolbar icon once more from a supported page. Expect the ON badge to clear and the buddy, selection bubble and any highlight to disappear from every open tab. Open another supported website and navigate Back/Forward; the buddy must stay absent. A buddy reappearing or remaining interactive fails verification.
4. Turn it on again, then off again, including after waiting with extension DevTools closed for the worker to become idle. Expect the same behavior without duplicate UI or a request replay. Confirm normal webpage controls still work and that merely enabling or selecting text creates no Gemini request.
5. If practical, revoke the optional site access in Chrome's extension settings and try again. Denial should retain only the current-tab fallback with a TAB badge; no other tab should silently gain access. Inspect extension Errors/service-worker console for unexpected errors, and report the affected page and visible badge if either toolbar operation still fails.

**VERIFIED by the user.** Commit and push to `final-touchs` were explicitly requested; no later milestone or deployment is authorized.

## User-selected AI provider, model, and key — 29 October 2026

Status: **VERIFIED by the user**. The user confirmed the three-provider Settings flow, then reported a key-overwrite bug. After the fix, the user confirmed “good, its working” and explicitly requested a commit and push to `website`. ZIP packaging, website deployment, publication, and production resource changes remain unapproved.

### What changed

- First-use setup and Settings let the user choose Google Gemini, OpenAI, or Groq, select a listed model, and save, replace, or remove its API key. During initial verification the user found that saving another provider overwrote the prior key. The corrected version stores one model/key record per provider and a separate active-provider marker. The input stays masked and empty after saving; switching back restores that provider's model and can reuse its key. Provider/model/key are strictly validated and stored in trusted `chrome.storage.local`, separate from the two existing sharing choices.
- Saving requests access only to the chosen provider's HTTPS origin via the existing optional-host declaration. Denial leaves the key unsaved. The required loopback API host grant was removed; current extension guidance and selected-text requests now go directly from the background worker to the selected provider. The local Cloudflare Worker remains for historical development and is not deployed.
- The existing privacy filter and shared result schemas still bound content and reject invalid output. Guidance target IDs must belong to the filtered inventory and are rechecked against the live page by the content script. Stop, navigation, consent withdrawal, and changed provider settings invalidate pending work. No page action is automated.
- README and local API notes distinguish current user-key setup from the retained local Worker. Provider API documentation used for the request formats and model choices: [Gemini models](https://ai.google.dev/gemini-api/docs/models), [OpenAI models](https://developers.openai.com/api/docs/models), [Groq structured outputs](https://console.groq.com/docs/structured-outputs).

### Actual checks

| Exact command/check | Result |
| --- | --- |
| `corepack pnpm typecheck` | Exit 0: shared, API, and extension TypeScript checks. |
| `corepack pnpm lint` | Exit 0. |
| `corepack pnpm test` | Exit 0: 92 API and 135 extension unit tests passed. New tests cover the three direct request formats, key omission from bodies, malformed output, and saved-setting validation. |
| `WRANGLER_LOG_PATH=/tmp/clickpilot-provider-wrangler-final.log corepack pnpm build` | Exit 0: extension built; retained API Worker build was dry-run only. |
| `corepack pnpm exec playwright test tests/e2e/provider-settings.spec.ts --workers=1 --output=/tmp/clickpilot-provider-e2e-final-results` | Exit 0: 5 browser tests passed. They cover all three provider routes, saved selection after panel reload, selected-text routing, key removal, and denied provider access. Provider responses and keys are synthetic. |
| `corepack pnpm exec playwright test tests/e2e/global-activation.spec.ts --workers=1 --output=/tmp/clickpilot-provider-global-results` | Exit 0: 2 activation regression tests passed. |
| Built manifest and bundle inspection | Manifest has no required host permission and retains optional HTTP/HTTPS site access. No `127.0.0.1:8787`, `fixture-private-key`, or `GEMINI_API_KEY` marker was found in built JS/HTML/manifest. |
| `git diff --check` | Exit 0 after the source and documentation updates. |
| Broader `corepack pnpm exec playwright test --workers=2 --output=/tmp/clickpilot-provider-all-results` | Stopped after historical browser specs failed on prior UI/local-backend assumptions. This is **not a passing full suite**. The new provider suite and focused activation regression above pass. The older assistant/text/buddy browser fixtures still target port 8787 and need migration; some mock-guidance selectors were already stale. Log: `/tmp/clickpilot-provider-all.log`. |

The first sandboxed browser attempt could not bind localhost (`EPERM`); the focused browser checks ran with approved local execution. An interrupted broader run left a fixture server on port 4173; it was stopped before the final focused rerun. No real provider key or live API call was used. Headless tests pregrant provider hosts in a disposable manifest; the denied-permission test stubs Chrome's response. They do not verify the native permission prompt, provider account/model access, quotas, billing, Chrome restart persistence, or an actual side panel. [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage) persists local settings until extension removal but does not encrypt them; [OpenAI's API guidance](https://developers.openai.com/api/reference/overview) recommends server-held keys. The user-requested local-key mode is a disclosed security tradeoff.

### User-reported provider-key overwrite fix

The reported cause was confirmed: the first implementation wrote all providers to `clickpilot.provider-settings`, so saving a second provider replaced the first record. Settings and the background worker now use `clickpilot.provider.gemini`, `clickpilot.provider.openai`, and `clickpilot.provider.groq`, plus `clickpilot.active-provider`. Save and remove affect the chosen provider only. A valid old single-provider record is read and migrated on the next save. If an earlier build already replaced a key, that overwritten value is unavailable and must be entered again.

| Exact command/check | Result |
| --- | --- |
| `corepack pnpm typecheck` | Exit 0. |
| `corepack pnpm lint` | Exit 0. |
| `corepack pnpm test` | Exit 0: 92 API and 137 extension unit tests passed, including separate-provider and legacy-record reads. |
| `WRANGLER_LOG_PATH=/tmp/clickpilot-provider-keys-wrangler.log corepack pnpm build` | Exit 0: extension built; retained API Worker dry-run only. |
| `corepack pnpm exec playwright test tests/e2e/provider-settings.spec.ts --workers=1 --output=/tmp/clickpilot-provider-keys-e2e-results` | Exit 0: 7 browser tests passed. New tests cover Groq → Gemini → Groq key/model retention and migration of the prior record; provider keys and replies were synthetic. The first sandbox attempt could not bind localhost, so this run used approved local execution. |
| Built manifest and bundle inspection | Required hosts remain absent and optional hosts remain unchanged. No `127.0.0.1:8787`, `fixture-groq-key`, `fixture-gemini-key`, or `GEMINI_API_KEY` marker was found in built JS/HTML/manifest. |
| `git diff --check` | Exit 0. |

### Numbered manual Chrome verification

1. Run `corepack pnpm build`, reload `apps/extension/.output/chrome-mv3` at `chrome://extensions`, and start `python3 -m http.server 4173 --directory tests/fixtures`. Open `http://127.0.0.1:4173/guidance.html`, activate Klicko with the toolbar, and open its Settings. Expect provider, model, and masked API-key fields. Blank or duplicated controls fail.
2. Choose Groq and a listed model, paste your Groq key, and select **Save provider**. Grant Chrome access to Groq's API origin if prompted. Expect a saved message and an empty masked field. Choose Gemini, select a model, paste your Gemini key, and save. Expect the same saved message and empty field. A visible key or unexpected broad permission prompt fails.
3. Switch the Provider dropdown back to Groq. Expect its earlier model and “A key is saved for this provider”; leave the key blank and select **Save provider**. Reload the extension, reopen Settings, and expect Groq still selected with its model and saved-key note. Switch to Gemini and expect its model and saved-key note too. If either provider asks for its key again, the fix has failed.
4. With Groq active, enable **Webpage guidance**, ask **“Find Primary target”** on the fixture, and inspect the page. Expect one highlight and instruction, with the counter still at zero until you click yourself. In the extension service-worker Network panel, expect one HTTPS request to Groq and none to Gemini or port 8787. Switch to Gemini, save with its key field blank, ask again, and expect only a Gemini request. Use only fixture data; do not share Network captures containing authorization headers. Missing guidance, the wrong provider, or an automatic click fails.
5. Open `http://127.0.0.1:4173/text.html`, enable **Selected-text assistance**, select the public fixture paragraph, choose **Ask Klicko**, type a question, then press **Ask**. Expect no provider request until Ask, then an answer from the selected provider. A selection alone causing a request fails.
6. Close and reopen Chrome with the same installed extension. Expect both providers' saved models/keys to remain usable after selecting and saving each one with a blank key field. With Groq selected, choose **Remove saved key** and ask again. Expect a clear setup error and no Groq request. Switch to Gemini; its saved-key note must still appear, and after saving it should still answer. Revoke a provider's site access in Chrome settings and save again; denial must leave a new key unsaved. Check extension Errors and the service-worker console for unexpected errors without copying credentials.

**STOP: VERIFIED.** The user authorized the `website` branch commit and push. ZIP packaging and website deployment remain unapproved.

## Downloadable Chrome ZIP — 2 November 2026

Status: **VERIFIED by the user** on 3 November 2026. After confirming the ZIP works correctly, the user explicitly requested a commit and push to `website`. Website deployment and store publication remain unapproved.

### Completed

- Added `corepack pnpm package:extension` to run WXT's Chrome ZIP build and copy the archive to `website/public/downloads/klicko-chromium.zip` without adding a dependency. The website now downloads that exact archive from its existing Install section. Installation and FAQ copy explain the user's own provider key and manual unpacked loading.
- Updated the website release notes to describe the current direct-provider extension instead of the historical localhost API. A later download from a different extracted folder may use a different extension identity, so locally saved keys may need to be entered again.
- The archive is 2.06 MB with `manifest.json` at its root. Its SHA-256 is `9ca57c12f4a0e5e40d4ba4d0feb9e0dea83856d840e656ff91df435b99ca0e25`. This checksum identifies the local artifact prepared here; regenerate it after any extension change.

### Actual checks

| Exact command/check | Result |
| --- | --- |
| `corepack pnpm package:extension` | Exit 0: WXT built Chrome MV3 and produced the site-hosted ZIP. |
| `unzip -t website/public/downloads/klicko-chromium.zip` | Exit 0: every archive entry passed integrity checking. `unzip -Z -1` showed `manifest.json` at archive root and only built extension assets. |
| `shasum -a 256 website/public/downloads/klicko-chromium.zip apps/extension/.output/clickpilotextension-0.1.0-chrome.zip` | Exit 0: both archives had the same checksum above. |
| Built manifest and bundle inspection | MV3 manifest names Klicko, has no required host grant, and contains optional HTTP/HTTPS access. No `127.0.0.1:8787`, `GEMINI_API_KEY`, or synthetic fixture-key marker was found in built JS/HTML/manifest. |
| `corepack pnpm typecheck` / `corepack pnpm lint` / `corepack pnpm test` | Exit 0 for all: 92 API and 137 extension unit tests passed. |
| `npm run typecheck` / `npm run lint` / `npm run build` in `website/` | Exit 0 for all; Vite built the site with the ZIP in its public assets. |
| `npm run test:e2e` in `website/` | Exit 0: 5 Chrome browser tests passed, including an actual ZIP download and its filename/size. The first sandbox run could not bind `127.0.0.1:4174` (`EPERM`); the approved local run passed. |
| Extracted-ZIP Chromium smoke check | Exit 0: extracted the site-hosted ZIP into a temporary folder; Chromium loaded its MV3 worker, read Klicko v0.1.0 from the manifest, and opened `sidepanel.html` with title Klicko. The first sandboxed browser launch failed; the approved local launch passed. |
| `node --check scripts/package-extension.mjs`, `cmp website/public/downloads/klicko-chromium.zip website/dist/downloads/klicko-chromium.zip`, and `git diff --check` | Exit 0 for all; the production website build contains the exact archive prepared for download. |

### Manual Chrome verification

1. From the repo root, run `corepack pnpm package:extension`. In `website/`, run `npm run dev` and open `http://127.0.0.1:4174`. Choose **Get Klicko → Download Extension**. Expect a file named `klicko-chromium.zip`. A disabled button, missing file, or source-code ZIP fails.
2. Extract the downloaded ZIP to a folder you will keep. That folder must directly contain `manifest.json`, `background.js`, `sidepanel.html`, and asset folders. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select that folder. Expect a Klicko card without extension errors. Selecting the ZIP itself or a parent folder fails.
3. On a public test page, activate Klicko and open the sidebar. Choose Gemini, OpenAI, or Groq, add your own key in Settings, grant only the provider access Chrome requests, and enable the desired sharing choice. Ask for guidance on a harmless page. Expect a provider response and a highlight, with no automatic webpage click. If a provider call fails, inspect the extension's **Errors** and service-worker console without copying key headers.
4. Close and reopen Chrome with the extracted folder still in place. Expect the extension to load and its saved provider choice to remain available. If replacing an earlier unpacked install with a different folder changes the extension identity, enter your key again.

The exact ZIP loaded in automated Chromium, and the user confirmed the package works correctly in their browser. Brave installation was not separately evidenced. The local website serves the archive; making it publicly downloadable still requires a separately approved website deployment and its release prerequisites.

**STOP: VERIFIED.** The user authorized the `website` branch commit and push. Do not start deployment or a later milestone without separate approval.

## Vercel website build repair — 3 November 2026

Status: **AWAITING USER VERIFICATION**. The user supplied a Vercel log for branch `website` at commit `fe87377`: npm installed 10 packages, then `npm run build` failed with `sh: line 1: tsc: command not found`.

The checked-in `website/package-lock.json` had 10 `link: true` entries pointing to local `../node_modules/.pnpm/` and `../prototypes/robot-playground/node_modules/` paths. TypeScript and Vite were among those links. The old lockfile described this machine's symlinks instead of a standalone install. In an isolated temporary copy of `website/`, npm generated a registry-backed lockfile with 143 package entries and no parent-directory links; only that lockfile was copied into the repository. `website/package.json` and all application, extension, and ZIP files remain unchanged.

| Exact command/check | Result |
| --- | --- |
| `npm install --package-lock-only --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=15000` in the isolated copy | Exit 0; produced registry-resolved TypeScript 5.9.3 and Vite 8.3.5 entries with integrity hashes. The first sandboxed registry attempt stalled; approved network access completed the command. |
| `npm ci --no-audit --no-fund --fetch-retries=0 --fetch-timeout=30000` in the isolated copy | Exit 0: 118 packages installed from the new lockfile, including `tsc` and Vite. |
| `npm run typecheck`, `npm run lint`, `npm run build` in the isolated copy | Exit 0 for all; Vite built `dist/` successfully. |
| `npm run test:e2e` in the isolated copy | Exit 0: 5 Chrome tests passed, including the ZIP download. |
| `git diff --check` plus lockfile inspection | Exit 0; the checked-in lockfile exactly matches the clean-copy lockfile, has 143 package entries, and contains no linked or parent-directory packages. |

### Vercel verification after the lockfile reaches `website`

1. Start a new Vercel build from the updated `website` commit. Expect npm to install the build tools and `npm run build` to finish with Vite's successful build message. `tsc: command not found` means Vercel is still building the old commit or using a custom install setting that omits development dependencies.
2. Open the deployed site, choose **Get Klicko → Download Extension**, and confirm the downloaded file is `klicko-chromium.zip`. Also open `/downloads/klicko-chromium.zip` directly on the deployment domain; a 404, HTML page, or missing download means the wrong root/output directory was deployed.
3. Extract the ZIP and confirm `manifest.json` is directly inside the extracted folder. In Chrome, use **Developer mode → Load unpacked** and select that folder. Expect Klicko without extension errors; loading a source ZIP or a parent folder fails.

The real Vercel build has not yet been rerun with this lockfile. The user must confirm the deployed result before this repair is marked verified. The prior explicit authorization to commit and push this `website` release covers its immediate verification repair.
