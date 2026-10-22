# ClickPilot progress

Updated: 22 October 2026.

## Current status

Planning: REVIEWED — user approved starting milestone 1.

Milestone 1: VERIFIED by user.

Milestone 2: AWAITING USER VERIFICATION.
Milestone 3: VERIFIED by the user in Chrome on 21 October 2026.
Milestone 4: AWAITING USER VERIFICATION — explicitly approved by the user on 21 October 2026.
Milestone 5A: VERIFIED by the user on 22 October 2026.
Milestone 5B: VERIFIED by the user on 22 October 2026. Relevant commit/push to `milestone-5B` is authorized; milestone 6A and deployment remain unapproved.

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
| 6A | Multi-step outcome verification | NOT APPROVED | Not run |
| 6B | Navigation and lifecycle recovery | NOT APPROVED | Not run |
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
