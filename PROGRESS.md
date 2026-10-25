# ClickPilot progress

Updated: 25 October 2026.

## Current status

UX-1: **AWAITING USER VERIFICATION**, 25 October 2026. Approved reliability/onboarding scope implemented. Final typecheck/lint/build passed; **92 API + 119 extension unit tests** and **131/131 Chromium tests** passed. The UX-1 entry at the end records the root cause, changes, exact checks, visual evidence, limitations and numbered Chrome steps. UX-2 has not begun and requires separate approval after UX-1 verification.

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

Status: **AWAITING USER VERIFICATION**. The user approved the reviewed UX-1 plan with “ok approved”. Work is limited to UX-1; the chat-first UX-2 redesign has not begun. No commit, push, deployment or publication was performed. Existing local PLAN.md/PROGRESS.md edits were preserved.

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

**STOP: AWAITING USER VERIFICATION.** Do not begin UX-2, commit, push, deploy or publish without the required explicit authorization.
