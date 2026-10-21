# ClickPilot progress

Updated: 21 October 2026.

## Current status

Planning: REVIEWED — user approved starting milestone 1.

Milestone 1: VERIFIED by user.

Milestone 2: AWAITING USER VERIFICATION.
Next proposed milestone: 3 — Highlight, arrow, and tooltip; not approved.

The user confirmed milestone 1 in Chrome and explicitly authorized milestone 2 on 21 October 2026. The user then reported that inspection failed on the localhost fixture in both Brave and Chrome. A focused milestone 2 fix is implemented and automated checks pass; manual verification in both browsers is still required.

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
| 3 | Highlight, arrow, tooltip | NOT APPROVED | Not run |
| 4 | Mocked single-step guidance | NOT APPROVED | Not run |
| 5A | Local backend contract and validation | NOT APPROVED | Not run |
| 5B | Real Gemini single-step guidance | NOT APPROVED | Not run |
| 6A | Multi-step outcome verification | NOT APPROVED | Not run |
| 6B | Navigation and lifecycle recovery | NOT APPROVED | Not run |
| 7 | Optional screenshot fallback | NOT APPROVED — OPTIONAL | Not run |
| 8 | Security review and release preparation | NOT APPROVED | Not run |

## Evidence and limitations

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

- Verify milestone 2 in Chrome. If a check fails, fix only milestone 2 and rerun checks. Do not begin milestone 3 until the user confirms milestone 2 and explicitly approves milestone 3.
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

After user confirmation, mark milestone 2 complete and separately request approval for milestone 3. No commit or push is authorized for milestone 2 by the earlier milestone 1 Git permission.
