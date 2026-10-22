# ClickPilot implementation plan

Status: Milestone 1 verified; milestone 2's separate privacy verification remains unconfirmed. Milestone 3 is verified in Chrome. Milestone 4 is implemented with manual verification pending. The user explicitly approved milestone 5A on 21 October 2026; the local contract is implemented and was verified by the user on 22 October 2026. Milestone 5B's revised plan was explicitly approved on 22 October 2026; implementation, automated checks and user manual verification are complete. Milestone 5B is VERIFIED; the user authorized its commit/push to milestone-5B. Later milestones remain unapproved.
Prepared: 21 October 2026.

## Sources and architecture review

Read `AGENTS.md` and `docs/clickpilot-production-architecture.md` before implementation, together with this plan and `PROGRESS.md`. The requested `docs/architecture.md` does not exist; the production architecture file is the available source. This plan does not rename or modify it.

The architecture has suitable boundaries: React side panel coordinates guidance, the content script owns page observation and rendering, the background worker handles browser permissions and routing, and a later Cloudflare Worker owns the Gemini secret and model calls. Keep those boundaries without creating all proposed files upfront.

Apply these clarifications when implementing:

- The architecture's broad Phase 0 and embedded build prompt are reference material, not authorization to implement several milestones. Use the smaller approval gates below.
- The side panel owns active session state. The background worker must not become a second guidance coordinator or depend on surviving suspension. Persist only the minimum recovery metadata when recovery is introduced.
- Use ordinary TypeScript functions and a small explicit transition function for guidance state; no state-machine library, agent framework, generic messaging framework, database, or speculative abstraction.
- Use the proposed `apps/extension`, later `apps/api`, and shared contract location only when needed. Group related functions; the architecture's file tree is an ownership guide, not a file creation checklist.
- Start with plain CSS. Tailwind is listed in the architecture's reference stack but is unnecessary for this small UI. Explain all proposed dependencies before adding them; get approval for significant additions.
- Internal page identity and outbound page context are different. Keep document/navigation identity local; omit URL query strings, fragments, sensitive path segments, and unnecessary page titles from outbound context. Sanitization is not proof that arbitrary page text is safe.
- Resolve the architecture's request-ID inconsistency with an increasing request number within a random session ID. Tab, document, navigation, snapshot, and request checks collectively reject stale results; an ID alone is insufficient.
- Screenshot fallback is optional and separately approved after DOM-only guidance. Coordinate-only targeting remains outside the MVP.
- Model names, SDK/API behavior, quotas, prices, provider data policies, and deployment controls in the architecture are assumptions to verify against official documentation at the relevant implementation milestone. No current availability or cost claim is made here.

## Rules for every milestone

1. Obtain explicit approval for exactly one milestone. Before coding, state its goal, likely files, approach, acceptance criteria, tests, dependencies, and permission changes.
2. Implement only that milestone. Never automatically click, type, submit, or navigate. Never extract field values, passwords, editable content, cookies, tokens, payment details, or full page HTML.
3. Validate untrusted messages at runtime from the first messaging slice. Add Zod with the approved backend slice, not in anticipation of it. Treat website text and model responses as data.
4. Run relevant typecheck, lint, unit tests, browser tests, and build. Record exact commands, exit results, and any limitations. A skipped or unavailable check is not a pass.
5. Give numbered Chrome verification steps with expected results and visible failure signals. Record actual evidence in `PROGRESS.md` and set the milestone to `AWAITING USER VERIFICATION`.
6. Stop. Fix only the current milestone if verification fails. Start another milestone only after the user confirms verification and explicitly approves the next one.
7. Never commit, push, deploy, publish, or change production resources without separate explicit permission.

## Verification setup

Use pnpm scripts with predictable names, introduced in milestone 1: `pnpm typecheck`, `pnpm lint`, and `pnpm build`. Add `pnpm test` with the first meaningful unit tests and `pnpm test:e2e` with Playwright. These are proposed commands, not commands that currently exist or have passed. Record the actual unpacked-extension output directory after the first build.

Use a small local fixture served on localhost, with Settings/Profile controls, a dialog, duplicate labels, hidden and disabled controls, fake sensitive fields, SPA and full navigation, and a three-step workflow. Add cases only when their milestone needs them. Never use real personal information in fixtures.

Vitest checks pure selection, filtering, validation, and state behavior. Playwright checks real geometry, visibility, pointer interaction, and browser workflows. Explain the test dependencies before adding them. Browser fixtures and Chrome verification remain necessary: a simulated DOM cannot prove layout or extension permission behavior. If automated extension testing is unavailable, report that limitation and run the documented Chrome workflow manually; do not substitute a passing unit test claim.

For every Chrome check: rebuild and reload the unpacked extension first. Check the side panel, page console, and extension service-worker console for unexpected errors. Failed expected behavior, duplicate UI, stale overlays, or unsolicited actions mean verification failed. Do not log sensitive page content for diagnostics.

## Milestone 1 — Extension foundation and side panel

**Goal:** Load a minimal MV3 extension and reliably open its side panel through the toolbar action.

**Likely files:** Root package/workspace and lint/typecheck configuration; `apps/extension/package.json`, WXT configuration, background and side-panel entrypoints, a small panel component and stylesheet; README; `PROGRESS.md`.

**Scope:** WXT, React, strict TypeScript, basic panel open/close and honest empty state. Explain WXT's build role and development dependencies before installation. Request `sidePanel` for panel access and `activeTab` for deliberate toolbar activation; defer `scripting` until milestone 2 and `storage` until recoverable state requires it. No host permissions, page scanning, mock answers, backend, or screenshot capture.

**Acceptance and automated checks:** Production build produces a loadable MV3 extension; typecheck, lint, and build pass. Inspect generated manifest and bundle for intended permissions and absence of secrets. No artificial unit test just to make a test command pass.

**Manual Chrome verification:**

1. Open `chrome://extensions`, enable Developer mode, and load the documented build directory. Expect ClickPilot without load errors; inspect extension errors if loading fails.
2. Open an ordinary web page and click the extension toolbar icon. Expect one side panel with a clear idle state, with no page mutation or network request to an AI service.
3. Close/reopen the panel and reload the extension. Expect the panel to open normally again and no uncaught errors; blank panels or duplicate UI fail this check.

**Gate:** User verifies foundation and separately approves milestone 2.

## Milestone 2 — Safe, compact DOM observation

**Goal:** Observe permitted visible controls and inspect the bounded result locally.

**Likely files:** Content/background entrypoints, `src/features/observer/`, a small shared message module, panel observation view, `tests/fixtures/`, unit/browser tests and configuration, README, progress.

**Scope:** Explain and add `scripting` for on-demand content-script injection. Toolbar activation, permission checks, idempotent injection, document/navigation identity, bounded snapshots (maximum 150 controls), ephemeral ID registry, safe labels/roles/rectangles/disabled state, and explicit unsupported/reactivate states. Keep registry references inside the content script. Add runtime message checks and cleanup on Stop, navigation, tab change, and panel disconnection. Do not claim a panel button grants `activeTab`. Support top-level ordinary pages; document iframe, shadow-tree, canvas, and protected-page limitations.

**Acceptance and automated checks:** Test visible/hidden/offscreen/detached elements, accessible labels, duplicates with bounded safe context, disabled controls, count/length bounds, and omission of sensitive values. Test repeated injection and identity invalidation. Add Vitest and Playwright with their purpose explained; run all applicable scripts and build. No page content leaves the extension.

**Manual Chrome verification:**

1. Activate on the local fixture, then request observation in the panel. Expect visible named controls with distinct IDs and disabled state; hidden controls must be absent.
2. Enter fake marker strings into password, ordinary input, and editable fields. Observe again; inspect the local snapshot and any diagnostic output. Those values must be absent.
3. Activate repeatedly, reload, and navigate within the fixture. Expect one content-script instance and newly valid snapshot identity; old IDs must not remain usable.
4. Switch tabs, navigate cross-origin, and try a protected Chrome page. Expect paused, reactivation, or unsupported guidance as appropriate, with no silent permission expansion.

**Gate:** User verifies safe extraction before overlays.

## Milestone 3 — Highlight, arrow, and tooltip

**Goal:** Select an observed element manually in a local debug panel and display accurate, non-blocking guidance.

**Likely files:** `src/features/overlay/`, observer registry integration, content messages, panel debug controls, fixture/browser tests, progress.

**Scope:** Shadow DOM isolation, SVG/CSS geometry, text-only tooltip rendering, and pointer-transparent decorations. Before every draw, recheck document/snapshot identity, connectivity, visibility, usable geometry, and obscuring. Follow user scrolling/resizing without scrolling the page automatically. Clear invalid targets, overlays, listeners, and observers on Stop or invalidation.

**Acceptance and automated checks:** Browser tests cover alignment, scroll/resize/zoom, moving or covered targets, cleanup, hostile tooltip strings, and clicking through decorations. Record a 20-case fixture interaction matrix with actual results. Run applicable unit/browser checks, typecheck, lint, and build.

**Manual Chrome verification:**

1. Observe the fixture and select a target ID. Expect a highlight, arrow, and readable tooltip anchored to that exact control; duplicate labels must not select the wrong element.
2. Scroll manually, resize the window/panel, and change browser zoom. Expect aligned decoration or safe removal when the target becomes invalid; drifting geometry fails.
3. Click the highlighted control yourself. Expect its normal behavior; overlay interception or any unsolicited click fails.
4. Hide/remove/cover the target, navigate, switch tabs, close the panel, and press Stop in separate runs. Expect cleanup and an honest state instead of stale decoration.

**Gate:** User verifies overlays before end-to-end guidance.

## Milestone 4 — Mocked single-step guidance

**Goal:** Exercise question → observation → selection → highlight → waiting for the user without an AI API.

**Likely files:** Panel guidance UI, `src/features/session/`, explicit fixture-only mock selection, message integration, unit/browser tests, progress.

**Scope:** Clearly labelled Mock mode with supported fixture tasks and honest unsupported answers. Use small explicit session states, session/request identity, cancellation, Stop/Retry, and at most one refresh after an invalid target. Reject delayed or superseded results. A click is an observed action, not proof the task is complete. No provider abstraction beyond what this slice needs.

**Acceptance and automated checks:** Test the full fixture path, unknown tasks, ambiguous/missing targets, delayed replies, navigation and Stop during selection, bounded retry, and no autonomous browser action. Run all applicable checks and build.

**Manual Chrome verification:**

1. Activate the fixture and submit a documented mock task such as finding Settings. Expect a visible Mock label, matching highlight, and waiting state; the page must not act by itself.
2. Submit an unsupported or ambiguous task. Expect a clear limitation or clarification, never fabricated guidance.
3. Use deterministic delayed/invalid mock cases; submit a newer task, navigate, or Stop before the result arrives. Expect obsolete results to be ignored and no stale overlay.
4. Click the target yourself. Expect an action acknowledgement without a false verified-completion claim. Inspect network activity: no backend or model calls.

**Gate:** User verifies the local end-to-end prototype. Backend requires explicit milestone 5A approval.

## Milestone 5A — Local backend contract and validation

**Goal:** Establish a small, tested local API boundary before spending model quota.

**Likely files:** `apps/api/` Worker configuration and source, `packages/shared/src/` request/response contracts, API tests, local setup documentation, progress.

**Scope:** Explain Hono for routing, Zod for runtime contracts, and Worker tooling before adding them. Implement `POST /v1/guidance/next` with payload bounds, allowlisted operations/outcomes, privacy filtering, sanitized outbound context, target membership checks, safe errors, and no body logging. Use injected deterministic provider responses only in tests. The runnable API must explicitly report provider unavailable until milestone 5B; no mock success disguised as AI. Keep the endpoint local; no deployment or extension host-permission change yet.

**Acceptance and automated checks:** Test malformed/oversized requests, excessive labels, forbidden fields, unknown target IDs, invalid response variants, hostile page/model strings, provider-unavailable behavior, and privacy omission. Typecheck, lint, API/unit tests, extension regression tests, and builds must pass as applicable.

**Manual verification:**

1. Run the documented local Worker command and send a valid fixture request with the provided verification command. Expect an explicit provider-unavailable response with no purported model result.
2. Send malformed, oversized, and forbidden-field examples. Expect bounded validation errors; inspect local logs for absence of bodies or secrets.
3. In Chrome, rerun the milestone 4 fixture task. Expect unchanged, clearly labelled Mock mode and no backend call.

**Gate:** User verifies the local contract and separately approves real Gemini integration.

## Milestone 5B — Conversational Gemini replies with single-step visual guidance

**Status:** VERIFIED, 22 October 2026. Scoped implementation, automated checks and four real synthetic Gemini smoke cases are complete. The user confirmed manual verification and authorized committing/pushing the relevant code to `milestone-5B`. Deployment and milestone 6A remain unapproved.

**Goal:** Respond conversationally to one independent request: explain and highlight one grounded action, answer without highlighting, or ask for clarification/explain a limitation. Do not add multi-step planning, conversation memory, or autonomous browser actions.

**Approved result contract:** Replace `SelectionSchema` with a strict Zod discriminated union named `AssistantResultSchema`. There are three user-facing outcome categories; clarification and unsupported have separate literals for straightforward validation and UI branching.

| Category | Exact result fields | Display |
|---|---|---|
| Guidance | `kind: guidance`, `message`, `targetId`, `instruction` | Conversational `message` in the side panel; one validated highlight/arrow with separate `instruction` tooltip |
| Answer | `kind: answer`, `message` | Side-panel answer; no overlay |
| Clarification / Unsupported | `kind: clarification` or `kind: unsupported`, `message` | Specific question or honest limitation in the side panel; no overlay |

- Every `message`: trimmed, nonempty plain text, maximum **600 characters**. Guidance `instruction`: trimmed, nonempty plain text, maximum **160 characters**. Prompt for short replies, typically one to three sentences; reject overlong output rather than silently truncating it.
- Only guidance may include a target or instruction. Reject unknown fields on every variant, including targets on answers, selectors, scripts, executable commands, action arrays and step plans. Validate the ephemeral ID against the exact privacy-filtered inventory supplied to Gemini and the current local registry; reject invented, disabled or filtered-out targets.
- Retain the outer envelope (`protocolVersion`, `sessionId`, `requestId`, `pageKey`, `snapshotId`, `result`). The server supplies identity from the validated request; the model supplies only `result`. All variants must match the active tab/document/snapshot/request before display.
- Make the breaking HTTP contract change explicit: move request, success and error envelopes to **protocol version 2** together in approved 5B implementation. Update fixtures and clients together and reject version mismatches; no parallel legacy compatibility layer. Browser-internal observation/overlay messages remain separate.
- Remove model `complete` and `expectedOutcome` results/fields from this contract. An answer does not establish task completion; observed outcomes and progression remain milestone 6A work. Keep click acknowledgement explicitly unverified. Operational errors remain separate fixed API errors, never model-generated answers or unsupported-page replies.

**Behavior and grounding:** For a preferences question, guidance could say “You can open your preferences from Settings.” in the panel and “Click Settings.” beside an actually observed Settings target. An answer can explain the available controls without highlighting. Duplicate controls should prompt clarification; missing information should produce an honest limitation. These are design examples, not hard-coded AI successes.

Use only the current request and permitted sanitized context. General explanations must be clearly distinguished from current-page facts; never invent unseen page content, account state, field values or successful actions. Do not expand extraction to arbitrary prose, read inputs, browse other pages or add screenshots to make answers possible. If current context is insufficient, clarify or explain the limitation.

**Single-request flow:**

1. A user submission cancels the previous run and observes fresh context. Show at most the current question and reply; send no prior turns, transcript or summaries. Each request is standalone. A clarification is answered by submitting a new self-contained request; Retry may repeat the current task without adding conversational context.
2. Validate provider output with shared Zod schemas in the backend and validate the envelope/result again in the extension. Guidance also passes the existing content-script checks for live identity, connectivity, visibility, coverage, enabled state and geometry before either its narrative or decoration is presented as valid. Permit at most one target refresh, then pause honestly.
3. Answer/clarification/unsupported clears previous decoration and click listeners, displays plain text, and never calls the overlay renderer. Use ordinary React text children and tooltip `textContent`; HTML/Markdown-looking strings stay literal. No injected markup, Markdown renderer, automatic links or executable interpretation.
4. Apply timeout, response-size bounds, Stop/cancellation and stale-result rejection to every variant. New requests, navigation, tab changes, relevant snapshot invalidation and panel disconnection must prevent stale answers as well as stale overlays. A user click may acknowledge an action but must never trigger an automatic next step or model request.

**Files/contracts expected to change after approval:**

| File or area | Scoped change |
|---|---|
| `packages/shared/src/guidance.ts` | New result union and text bounds; protocol 2 envelope/types; grounding checks apply only to guidance targets |
| `packages/shared/src/privacy.ts` | Preserve minimization/sensitive-context rules; filter every variant's message and guidance instruction |
| New `apps/api/src/gemini.ts`; existing `src/app.ts`, `src/index.ts`, `wrangler.jsonc` | Direct REST request/prompt aligned with the union; backend-only secrets, bounded responses, validation, cancellation/timeouts, safe errors and kill switch |
| `apps/extension/src/lib/messages.ts`, `entrypoints/background.ts` | Explicit live request/cancel/response routing, validated replies and tab identity checks; background remains a router, not a second coordinator |
| `apps/extension/src/features/session/session.ts`, focused `AssistantPanel.tsx`, side-panel entrypoint/style | Reuse current cancellation guards and branch on the four result literals; render the current exchange, disclosure, Stop/Retry; preserve labelled Mock mode and existing visual design |
| Extension `package.json`, `wxt.config.ts`, lockfile | Link the existing shared Zod package; explain the minimum browser-supported local API host permission before adding it; enforce the configured exact API URL in code |
| Shared/API/unit/browser tests, fixtures, local verification script, setup docs and progress | Migrate contract examples and verify every outcome, error, privacy and lifecycle behavior |

Reuse the observer registry and existing overlay renderer; a separate panel message does not require rewriting them. No new agent/provider framework, SDK, state library, chat-history system, database, queue, authentication or Markdown dependency is planned. Explain any necessary dependency/architecture change before adding it.

**Privacy/security/runtime requirements retained:** Verify current official Gemini/Cloudflare contracts, structured-output support, model availability, quotas and data policies during approved implementation. Use direct REST unless evidence justifies a dependency. Keep secrets solely in excluded backend configuration. Disclose and minimize task/context before it leaves the extension; filter again on the backend. Preserve sensitive-context blocking, request/response bounds, no body/secret logging, safe errors, timeout/abort propagation, rate-limit/network errors, one-refresh limit and a kill switch. Missing credentials must yield provider unavailable, not fake AI success. Start with the local Worker; HTTPS is required for any later hosted use.

Deployment and effective quota/spend/abuse controls remain separate approval work. Do not treat CORS, extension IDs or in-memory counters as durable authentication/budget protection. If hosted controls need additional infrastructure, stop at local operation and seek a separately scoped decision.

**Acceptance and automated checks:**

- Test all four strict variants, blank/missing/oversized text, forbidden target/instruction fields on text-only replies, old protocol/results (`highlight`, `ask_clarification`, `complete`, `expectedOutcome`), unknown/filtered/disabled targets, stale identity, arbitrary fields and plan/command injection. Preserve private-marker omission and safe-error tests.
- Browser tests cover panel message plus exact-target tooltip; answer/clarification/unsupported without overlays; clearing old decoration; hostile strings rendered literally; Stop/new-request/navigation/tab-change/panel-close races for text and guidance; no automatic actions or follow-up requests. Keep the existing mock/overlay regression suite.
- Deterministic provider tests cover valid replies, malicious output, missing targets, timeout, rate limit, network failure, cancellation and kill switch. Inspect outbound synthetic payloads and built client bundles for private markers/secrets. Test both backend and client validation.
- Run typecheck, lint, unit/API tests, extension/Worker builds, browser tests and updated local API checks; report exact commands/results. Record real Gemini smoke tests separately. Missing credentials mean live integration is unverified, not passed.

**Manual Chrome verification after implementation approval:**

1. Configure a backend-only secret, review the disclosure and submit a fixture question needing one action. Expect a short panel message, correct highlight and separate short tooltip, with no automatic action.
2. Submit an answerable question needing no highlight. Expect a useful panel answer and no old/new overlay or task-completion claim.
3. Submit ambiguous and insufficient-context requests. Expect a specific clarification or honest unsupported explanation, no guessed target. Resubmit clarification as a standalone request; no history should be sent.
4. Inspect fake-data payloads and hostile-text fixtures. Expect bounded context and literal text, no sensitive values/URL components/screenshots/client key, and no executed HTML or model-generated commands/selectors.
5. Stop/replace delayed text and guidance; navigate, switch tabs or close the panel. Expect stale text/overlays rejected, at most one invalid-target refresh and no automatic next step after a click. Disable the backend and test invalid output/timeouts/rate limits/kill switch; expect honest errors and working labelled Mock mode.

**Gate:** Obtain approval for this revised plan before 5B code, schemas, dependencies, permissions or secret setup. After implementation, stop for user verification of all outcomes. Deployment/public access and milestone 6A require separate approval.

## Milestone 6A — Multi-step outcome verification

**Goal:** Advance only after an observed outcome or explicit user confirmation.

**Likely files:** `src/features/verification/`, session transition logic, content event observation, panel progress UI, fixture and tests, progress.

**Scope:** Small allowlisted outcome vocabulary, target-ancestry click observation, bounded verification timeout, fresh snapshots between steps, and ambiguity recovery. Model text never becomes a selector or executable condition. An unchanged page after a click must not count as success. Offer Retry/Continue manually when objective confirmation is unavailable and distinguish manual confirmation from verified completion.

**Acceptance and automated checks:** Test a three-step fixture workflow, unrelated clicks, click-without-outcome, dynamic controls, navigation, timeouts, manual confirmation, and Stop during verification. Test deterministically first and record live smoke evidence separately; run all applicable checks and builds.

**Manual Chrome verification:**

1. Follow Settings → submenu → field on the fixture, performing each action yourself. Expect one instruction at a time and fresh targeting after each verified outcome.
2. Click elsewhere and use a fixture target whose action produces no change. Expect no automatic advancement; timeout must offer recovery.
3. Use Continue manually on an unverifiable step. Expect the UI to distinguish user confirmation from observed success. Stop midway; expect all guidance observers and overlays removed.

**Gate:** User verifies outcome handling before resumable sessions.

## Milestone 6B — Navigation and interrupted-session recovery

**Goal:** Recover safely from page, panel, and service-worker lifecycle changes.

**Likely files:** Session/checkpoint code, background tab events, content navigation checks, panel resume UI, lifecycle tests, progress.

**Scope:** Explain and add `storage` for minimal `chrome.storage.session` checkpoints. Persist identity/status only as needed; do not persist DOM inventories, screenshots, field content, or old target geometry. Keep task text volatile and ask the user to re-enter it when necessary. Handle full/SPA navigation, cross-origin permission loss, tab closure/switching, panel closure, and worker suspension. Resume only after checking access and obtaining a fresh snapshot; never replay an old target. Use `storage.local` only if a concrete preference is introduced.

**Acceptance and automated checks:** Test checkpoint validation, stale requests across restarts, SPA `pushState`/back navigation, tab mismatch, revoked access, and cleanup. Run lifecycle/browser coverage and all applicable checks/builds. Record any suspension scenario requiring manual Chrome verification.

**Manual Chrome verification:**

1. Start guidance and navigate using both SPA and full-page fixture routes. Expect old targets removed and fresh observation before resuming.
2. Switch/close tabs and navigate to a different origin. Expect pause or reactivation instructions; an in-panel retry alone must not be described as a new permission grant.
3. Stop the extension worker using Chrome's documented inspection controls, with debugging tools detached when testing natural suspension. Reopen the panel. Expect safe recovery or a clear need to restart, never replayed geometry.
4. Inspect extension session storage after pausing and stopping. Expect only documented minimal metadata, cleared on Stop; page inventories and screenshots must be absent.

**Gate:** User verifies the DOM-only multi-step MVP. Explicitly choose optional milestone 7 or proceed to milestone 8.

## Milestone 7 — Optional, separately approved screenshot fallback

**Goal:** Let a user share one reviewed screenshot when DOM-only guidance is insufficient.

**Likely files:** Capture module, background capture routing, panel consent/preview UI, bounded image API schema, privacy docs and tests, progress.

**Scope:** Explain capture access and any permission change before implementation; never add broad host access. Block sensitive contexts by default. User first requests capture, then sees a local preview and explicitly approves that image's upload. Consent applies to one capture/upload only. Hide overlay during capture, restore safely, bound dimensions/bytes locally, keep images volatile, and clear on cancel/Stop. Recheck active tab/document/geometry before capture, upload, and display. Accept only existing DOM target IDs; coordinate-only guidance remains excluded.

**Acceptance and automated checks:** Test cancel, denial, wrong-tab races, navigation/resize after preview, payload limits, repeat-request consent, unsupported pages, and no upload without consent. Verify no image/body logging or persistence. Run relevant checks/builds and consent browser tests.

**Manual Chrome verification:**

1. Request a screenshot on the fake-data fixture. Expect a local preview with no overlay and no image upload before approval.
2. Cancel, Stop, switch tabs, and navigate in separate preview runs. Expect discarded or invalidated capture and zero image upload.
3. Approve one preview. Expect exactly one bounded image upload and a validated DOM target; request another fallback and expect fresh consent.
4. Try a blocked sensitive context. Expect refusal and no capture/upload. Inspect network/storage using fixture data for unintended retention.

**Gate:** User verifies consent and capture behavior. Skipping this milestone does not block DOM-only release preparation.

## Milestone 8 — Security review and release preparation

**Goal:** Produce an understandable, measured, locally reviewable release candidate.

**Likely files:** Focused fixes to existing modules, security/behavior tests, `docs/test-matrix.md`, privacy documentation, README, optional CI configuration, progress.

**Scope:** Audit permissions, data flow, secrets, runtime validation, prompt injection, panel accessibility, cleanup, and all no-autonomous-action guarantees. Document limitations, troubleshooting, developer setup, and privacy practices. Prepare CI configuration if approved within this milestone; no remote push or release. For any proposed hosted endpoint, verify effective budget/quota controls, throttling, kill switch, and no sensitive logging before requesting deployment approval. Do not add unapproved infrastructure to satisfy that gate.

**Acceptance and automated checks:** Run all applicable typecheck/lint/unit/browser/build checks and record exact outcomes. Measure 20–30 curated tasks using synthetic/public data: selection accuracy and workflow completion with explicit denominators, plus all failures. Architecture targets of 90% selection and 80% completion are targets, not claims. Require zero observed autonomous actions and pointer-blocking overlays in the recorded matrix. Report coverage limits; no test proves universal safety.

**Manual Chrome verification:**

1. Load a fresh production build in a clean Chrome profile and follow the README without hidden setup knowledge. Expect a working toolbar-to-guidance flow or documented configuration requirements.
2. Run the fixture matrix and a small permitted public-site matrix. Record expected/actual targets, workflow results, unsupported cases, and visible errors.
3. Repeat permission expiry, invalid output, navigation, Stop, lifecycle, and optional screenshot-consent cases. Expect the documented safe failure and recovery behavior.
4. Review the permission list, privacy disclosure, known limitations, and measured results. Any unexplained permission, leaked fixture marker, stale overlay, or autonomous action blocks approval.

**Gate:** User approves verified release preparation. Commit, push, deployment, store submission, publication, and production changes still require explicit permission.

## Current approval gate

The revised milestone 5B plan was explicitly approved on 22 October 2026. Its single-step conversational scope is implemented and manually verified by the user. Actual checks and real Gemini smoke calls are recorded separately in PROGRESS.md. The user authorized committing/pushing its relevant code to `milestone-5B`. Milestone 6A and deployment remain unapproved.
