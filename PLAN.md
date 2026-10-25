# ClickPilot implementation plan

Current work: UX-1 approved; implementation and evidence are recorded in the final section below. Earlier milestone gates are historical.

Status update — 25 October 2026: the user confirmed milestone 6B is complete and approved scoped 7A implementation with the strict result union and retained side-panel explanation. The 7A branch was based on 6A; it has been fast-forwarded to existing 6B commit `109e04f` without creating a commit. Historical milestone records below are retained.

Earlier status: Milestone 1 verified; milestone 2's separate privacy verification remains unconfirmed. Milestone 3 is verified in Chrome. Milestone 4 is implemented with manual verification pending. The user explicitly approved milestone 5A on 21 October 2026; the local contract is implemented and was verified by the user on 22 October 2026. Milestone 5B's revised plan was explicitly approved on 22 October 2026; implementation, automated checks and user manual verification are complete. Milestone 5B is VERIFIED; the user authorized its commit/push to milestone-5B. Milestone 6A, including the continuation clarification below, was approved for implementation on 22 October 2026 and VERIFIED by the user on 23 October 2026 after the shared highlighting correction. The user authorized committing and pushing that correction to milestone-6A. Milestone 6B was explicitly approved on 23 October 2026 by “ok , continue with 6B”; later milestones remain unapproved.
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
- The revised milestone 6A below supersedes reference-architecture language requiring a declared outcome for every step: use AI-driven next-step reasoning with deterministic observation and optional structured outcome verification. Its temporary task context also supersedes 5B's standalone-request restriction only after 6A implementation is approved.
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

## Milestone 6A — AI-driven multi-step guidance with temporary task context

**Status:** IMPLEMENTED — AWAITING USER VERIFICATION, 22 October 2026. The user approved the final continuation clarification and implementation. Automated evidence and remaining limitations are recorded in `PROGRESS.md`; Chrome verification remains pending.

**Goal:** Let Gemini reason about the next action from the newly observed page while continuing toward the user's original goal. Use deterministic observation and optional structured outcome verification; do not require a predefined expected outcome for every step.

**Responsibilities:**

- Gemini chooses one grounded next action from the current sanitized control inventory, or returns an answer, clarification or limitation. It does not generate a workflow script or execute browser actions.
- The content script observes trusted user actions and permitted page/target changes. It reports facts, not inferred task success, and rechecks every proposed target against the live registry.
- The side-panel session controller owns temporary task context and decides whether to wait, retry, pause for user input or request the next AI step. The background remains a permission/identity-checking router.

**Likely files:** `apps/extension/src/features/session/session.ts`, `useGuidanceSession.ts`, `AssistantPanel.tsx`; content event observation and a small verification module if needed; `src/lib/messages.ts`, `src/lib/assistant.ts`, background routing; `packages/shared/src/guidance.ts`, `privacy.ts`; `apps/api/src/app.ts`, `gemini.ts`; synthetic fixtures, unit/API/browser tests, local API documentation, README and progress. Reuse existing observation, overlay and cancellation code without unrelated refactors.

**Minimal continuation signal:** Every guidance result must include `nextStep: "none" | "after_user_action"`. Gemini decides from the original goal, current sanitized controls and bounded previous-step context whether this is the final suggested action (`none`) or an intermediate action requiring another look at the page (`after_user_action`). For example, “show Settings” may end at Settings; “change a Vercel domain” may continue from Settings toward Domains. This is a planning signal, never proof of completion. Missing/invalid signals are rejected; text-only results cannot include a signal and never continue automatically.

- `none`: display final guidance and observe the user's action if it occurs, without automatically requesting another AI step. Never label the task successful merely because this is the final suggestion.
- `after_user_action`: wait for a trusted action, observe the updated page, then apply the controller's existing verification/no-progress gates before requesting another AI step. The model cannot bypass these gates.
- Preserve optional outcome checks, one in-flight request, at most one automatic target refresh per step, a **20-step** session ceiling and the popup correction's named **400ms settling / 5-second maximum** bounded observation window. At the ceiling, stop automatic progression and ask the user to start a new task. Retry does not reset the ceiling. A repeated identical target/instruction on an unchanged sanitized inventory pauses for user input.
- Add deterministic tests and manual checks for final versus continuing guidance, missing/invalid signals, forbidden signals on text replies, no continuation without user action, and no false success claims.

**Temporary task context — required:** Keep one bounded record in the active side-panel session, in memory only:

| Field | Meaning and bound |
|---|---|
| Original user goal | The submitted task, retained unchanged across steps; existing nonempty 240-character limit |
| Current step number | Positive bounded integer; increment when accepting a new guidance step, not for retries of the same step; stop for user input at a documented finite session step limit |
| Last attempted action | Only the immediately preceding attempt: a sanitized description up to 160 characters and an observed event enum (such as `none` or `trusted_click`); never input values, raw events, HTML or an accumulated summary |
| Observed verification status | Small explicit enum: `pending`, `verified`, `not_verified`, `unverifiable` or `user_confirmed`; a click or page change alone must not set `verified` |

For the first request, previous-step context is null. On each subsequent Gemini request, send the original goal, a **fresh sanitized DOM snapshot**, the step number and only the previous action/status. Replace that previous-step record after each attempt; do not append older steps, model replies, conversation turns, hidden reasoning or old snapshots. A step's optional outcome check is kept only while that step is active. Previous target IDs/geometry must never be reused as current targets.

Extend the shared strict request schema and provider prompt explicitly for this bounded context. Plan protocol **3** for request/success/error envelopes together; update clients, fixtures and API docs, and reject version mismatches rather than adding a legacy layer. Retain the four existing result kinds; permit an optional structured outcome only on `guidance`. Validate context types, text lengths, enum values, step bounds, unknown fields and total bytes at both boundaries. Apply privacy filtering to the goal, fresh snapshot and previous-action description before upload and again on the backend. Gemini receives only permitted origin/control context and bounded task context, not local identity metadata. Update the existing disclosure to explain repeated requests and the temporary context sent with them. No body/context logging.

**Observation and next-step flow:**

1. A new task cancels the old run and initializes a new session with its original goal. Observe, sanitize and request one Gemini result. Render guidance only after current-tab/document/snapshot and live-target checks succeed; the user performs every action.
2. Observe a trusted action within the highlighted target's ancestry. Clear obsolete decoration and collect permitted target/page changes during a bounded observation window. Coalesce events; unrelated clicks or arbitrary DOM mutations must not initiate requests.
3. If an optional outcome can be objectively checked, evaluate it deterministically. Keep the vocabulary small, initially target visibility or target expanded state, using allowlisted fields bound to the current target. Unsupported/malformed checks are rejected. No AI-generated JavaScript, arbitrary selectors, field-value reads or general-purpose condition language.
4. After a relevant action and a meaningful fresh page change, the controller may request the next Gemini step even when no outcome was supplied or objective verification is unavailable. Report the previous status honestly as unverified; a fresh snapshot supports new reasoning without proving the previous action or overall task succeeded. If a supplied check fails, no useful change is observed or the observation window expires, wait and offer Retry/Continue manually rather than looping. Manual continuation is recorded as `user_confirmed`, never objective proof.
5. Gemini reasons anew from the original goal and current snapshot. Allow one in-flight request, retain at most one automatic target refresh per step, and pause on repeated/no-progress guidance or provider errors. No recursive retry or background polling loop. Answers, clarification and unsupported replies pause progression; answers are not verified task completion. End the task on explicit user confirmation or Stop, with completion wording distinguishing user confirmation from observed step checks.

**Lifecycle and stale-request protection:** Context belongs to one session and tab, not the service worker. Check session ID, monotonic request ID, tab, document/navigation identity and snapshot before applying any async reply, observation or verification result; bind local step callbacks to the current attempt as well. Abort superseded requests where possible and always ignore late results. Retry preserves the original goal/current step while replacing the attempt; starting a different task creates fresh context. Stop, session termination, consent withdrawal, panel disconnection/closure and unrecoverable invalidation cancel pending work and clear all task context, observers and overlays. A terminated session cannot be revived by a late reply. In 6A, navigation invalidates stale work and pauses/ends safely; automatic continuation across full navigation, permission loss, panel/worker restart and resumable checkpoints remain 6B work.

**Boundaries:** No full conversation history, persistent memory, database, LangGraph, other agent/state framework, new dependency or browser permission is planned. No `storage` permission or checkpoint persistence in 6A. Do not expand extraction to private page prose, field values or screenshots, and never automatically click, type, submit or navigate. Task context stays volatile; restarting after termination requires a new task.

**Acceptance and automated checks:**

- Use a deterministic three-step synthetic workflow, including a step without an outcome check and a mixed sequence with an objective check. Assert every subsequent request retains the original goal, has a newly collected sanitized snapshot and contains only bounded last-step context. Include the synthetic goal “Change a Vercel domain” to prove intermediate Settings/Domains actions do not replace or lose the original intent; no live account change is needed.
- Test original-goal retention on Retry, correct step/attempt accounting, null initial context, replacement rather than history accumulation, bounds/unknown-field rejection and private-marker omission from prior-action context at both privacy boundaries. Reject malformed outcomes, selectors, scripts and stale target IDs; old protocol/result contracts remain rejected.
- Test unrelated/synthetic clicks, click-without-change, meaningful page changes without objective verification, dynamic controls, optional check success/failure, timeouts, manual continuation, repeated/no-progress guidance, finite step limits and bounded refreshes. A page change or model answer must never falsely mark completion.
- Test Stop, replacement, consent withdrawal, navigation, tab changes and panel closure during observation, verification and provider requests. Assert context cleanup and rejection of late replies/events from previous attempts/sessions, including no subsequent request or overlay after termination.
- During implementation run `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm test`, `corepack pnpm test:e2e` and `corepack pnpm build`. Keep deterministic browser/API coverage separate from any explicitly authorized real Gemini smoke evidence; report exact commands/results and unavailable checks.

**Manual Chrome verification after implementation:**

1. Build/reload the extension, run the local Worker and synthetic fixture server, activate the fixture and consent to AI assistance. Submit the documented synthetic domain-change goal once. Follow Settings → Domains → domain control yourself. Expect one instruction at a time and fresh targets that continue toward the original goal without re-entering it. A changing goal, stale highlight or autonomous page action fails verification.
2. Inspect only fake-data local request payloads. Expect the original goal, step number, fresh sanitized inventory and one bounded previous action/status; the first request has null previous-step context. Older snapshots/replies/history, field values, URL paths/query/hash, screenshots or secrets must be absent. Retry must retain the goal without incrementing the guidance step.
3. Exercise fixture steps with and without optional checks. Expect a new AI step after a relevant action and useful page change even without a declared outcome; the UI must keep unverified progress distinct from verified checks. Click elsewhere or use a target producing no change; expect waiting followed by recovery controls, not repeated AI requests or a success claim. Continue manually must be labelled user-confirmed.
4. Stop during observation and during a delayed reply; repeat with a replacement goal, consent withdrawal and panel closure. Expect cleanup, no late text/highlights/follow-up requests and no old task context on a fresh session. Navigate or switch tabs: expect safe invalidation/pause or restart instructions, not replayed targets. Check page/panel/worker consoles for unexpected errors. Any stale result, leaked context or unsolicited action fails verification.

**Gate:** Obtain explicit approval of this revised 6A plan before implementation. After implementation, record actual evidence in `PROGRESS.md`, set AWAITING USER VERIFICATION and stop. User verification and separate 6B approval are required before resumable sessions.

## Milestone 6B — Navigation and interrupted-session recovery

**Implementation approved on 23 October 2026** by “ok , continue with 6B”. Implementation/check evidence and the pending manual verification gate are recorded in `PROGRESS.md`. The dynamic popup correction remains awaiting its separate user verification. This section supersedes older reference-architecture recovery language and the 6A rule that navigation necessarily terminates task context. This approval does not mark the popup correction verified.

**Goal:** Preserve the original task across SPA/full-page navigation while its in-memory side-panel session survives; recover honestly when that memory is lost. All resumed guidance uses newly inspected controls, never replayed page state.

**Likely files:** Existing `session.ts`, `useGuidanceSession.ts`, `AssistantPanel.tsx`, background routing/tab events, content navigation/cleanup and message validation; a small checkpoint module if needed; WXT manifest configuration for `storage`; existing unit/browser fixtures and tests, README/local API documentation and `PROGRESS.md`. Shared contracts change only if required by concrete validated messages. No new framework, dependency, database, offscreen document or second guidance coordinator.

### Ownership and context lifetime

- The side-panel controller remains the only task owner. Keep the original submitted goal unchanged, the bounded step number, and at most one sanitized previous-action/status record in its existing in-memory session. Navigation and transport disconnection release page/attempt resources without destroying that task record. Stop, replacement, consent withdrawal and genuine task termination destroy it. Actual panel destruction loses that memory; no hidden background copy of task text is introduced.
- Keep **task lifetime** separate from **attempt/page lifetime**. Abort old provider work and invalidate its callbacks, request/attempt IDs, observation timers, registry, snapshot and overlay immediately on navigation. Retain only the task record when recovery is allowed. A new document/navigation identity is expected during navigation recovery; it must not be treated as permission to accept an old reply.
- Background remains a Chrome permission/identity router and minimal checkpoint writer. It does not plan steps, retain goals, manufacture task context or continue AI work when no live panel owns it. A content-port disconnect during document replacement is not proof that the panel closed. A panel-to-worker disconnect is not proof that panel memory was destroyed.

### Lifecycle transitions

Use small explicit controller transitions; the names below describe behavior, not a requirement for a state-machine library.

| Trigger | Task memory | Proposed transition and recovery |
|---|---|---|
| SPA route change or full-page navigation following a trusted action on continuing guidance | Preserve original goal and bounded context if panel survives | `waiting/verifying → navigating → revalidating → observing → selecting → waiting`. Cancel old attempt; settle the destination; check consent, active owned tab, document and access; inspect anew; send the same original goal with fresh sanitized controls. No repeated question. |
| Manual/unrelated navigation, or navigation while a provider reply is pending | Preserve surviving task; reject old reply | Invalidate page-bound work and pause with **Continue task on this page**. Continuing revalidates and reinspects; do not infer that navigation completed the pending action. |
| Navigation after guidance with `nextStep: none`, or after a text-only reply | Preserve goal only while task remains active | Clear old page presentation; no automatic next AI request. Offer explicit continuation/new task as appropriate. Final guidance never becomes an automatic multi-step request merely because navigation happened. |
| Different origin, lost/uncertain access, unsupported page | Preserve surviving goal | `navigating/revalidating → needs_reactivation` or unsupported pause. Ask for the ClickPilot toolbar gesture on the intended tab where required. After activation, explicit Continue performs fresh checks/inspection without asking for the goal again. No automatic cross-origin upload just because the panel is open. |
| Active tab changes | Keep task bound to its original tab | Clear overlays and pause. Returning to the owned tab offers Continue after revalidation. Do not silently move the task to another tab. |
| Owned tab closes | Terminate task | Abort/clear context, overlays and checkpoint. A different tab requires a new task. |
| Worker suspension/restart or worker-port loss, panel still alive | Keep panel's original goal/context | `active → connection_paused`. Clear page guidance; reconnect and validate ownership/access, then offer Continue. If authorization cannot be established, require toolbar reactivation. Never replay an in-flight request or depend on worker memory surviving. |
| Panel destroyed/closed/crashed | Goal unavailable | Cancel old work and remove live recovery authority. On reopening, validated minimal metadata can show **Previous task interrupted — enter your goal to restart**. Re-entered text starts a new session at step 1 with null previous-step context. No automatic model request. |
| Stop, task completion/termination, consent withdrawal, replacement | Destroy old task memory | Cancel attempts, invalidate tokens and clear old checkpoint/restart notice. Replacement then creates a new owner/task. Late events or storage writes cannot revive the old task. |

A panel merely hidden by Chrome is distinct from a destroyed panel document: continuation depends on whether its actual controller memory survives, not whether its UI was visible. If owner liveness cannot be established, fail closed and require restart/re-entry; metadata is not evidence that the goal exists.

### Navigation recovery and request accounting

1. On the first navigation signal, advance a local recovery/attempt generation, abort pending work, clear overlays/listeners/observation, and invalidate old snapshot/target bindings. Coalesce duplicate content/tab events for the same navigation; keep one recovery attempt and one request in flight. Retain the original goal, step count, consent and bounded previous context only in the surviving panel.
2. Wait for the destination document to be ready and its supported controls to settle, reusing the bounded popup observation approach where practical. Use clearly named bounded navigation settling/maximum-wait constants. Repeated redirects or navigation during inspection cancel that inspection and restart only within the finite recovery budget; endless redirects/loading pause for explicit Retry. Do not create an unlimited navigation-driven request loop.
3. Revalidate the active tab against the task's owned tab, current document/navigation identity and Chrome access before injection/inspection. On full navigation, obtain a new content-script document token; on SPA navigation, advance navigation identity even if the document remains. Deduplicate/reject obsolete events. Preserve the top-level-page scope.
4. Acquire a new snapshot/registry, sanitize through the current privacy boundaries, and check tab/document/generation again before sending the provider request and before applying its result. Gemini receives the unchanged original goal, bounded previous action/status and the fresh inventory. Never carry old target IDs, snapshot IDs, rectangles or coordinates into a targeting decision. Old identity tokens may be used only locally for rejection/scoped cleanup, never as resumable targets.
5. A trusted click followed by navigation is an observed event, not objective success. If its optional target-based outcome cannot be evaluated after unload, record it as `unverifiable`, not `verified` or a fabricated failed check. A deterministically known `not_verified` result still pauses; navigation cannot override it. Preserve the existing explicit manual-continuation distinction.
6. Automatic continuation is allowed only for an active continuing-guidance action, surviving consent/task ownership and a permitted settled destination. Manual/unrelated navigation and cross-origin recovery require explicit Continue. Keep the 20-step ceiling and target-refresh/no-progress bounds. A continuing action can advance at most one step; navigation/observation duplicates cannot both advance it. If navigation cancels a request for an already allocated step, retry that same step with fresh context, rather than incrementing again or resetting the ceiling.

### Permissions and minimal checkpoints

Propose adding only the **`storage` permission**, for `chrome.storage.session` interruption metadata surviving a service-worker restart. No new host permissions, `tabs`/`webNavigation` permission, `storage.local`, keepalive mechanism or task-text persistence is planned. Checkpoints stay in trusted extension contexts and are never exposed to content scripts or sent to Gemini. Chrome documents session storage and access boundaries in [chrome.storage](https://developer.chrome.com/docs/extensions/reference/api/storage); session storage is not durable browser-restart storage.

Use one bounded, strictly validated record for the owned task/restart notice, containing only a schema version, opaque session/owner tokens, tab ID, finite lifecycle-status enum, revision/generation and expiry timestamp. Avoid optional fields unless needed for a tested recovery decision. **Do not store the goal, previous instructions, previous-step prose, page URLs/titles, DOM/control inventories, target IDs, page snapshots, screenshots, credentials, field values or geometry.** Checkpoint metadata never authorizes access, restores consent, proves document identity or verifies task success.

- Persist a minimal interruption marker before starting active work. Reopening a panel with no goal can use it only for an honest restart notice. Discard malformed, unknown-version, expired or missing-tab records. Use a named bounded expiry (proposed 30 minutes) and remove expired records on access; no background alarm is needed.
- Serialize checkpoint mutations through the existing background message path, validate sender/ownership and revision, and guard pending writes/clears so delayed work from an old task cannot overwrite a replacement or recreate metadata after Stop. This is storage plumbing, not a second task controller. If storage is unavailable, retain surviving in-memory guidance where safe and report that interruption recovery metadata is unavailable.
- Stop, explicit termination/completion, consent withdrawal and tab closure remove the record and any restart notice. Replacement clears the old record before establishing its new owner. Panel destruction removes active resumable authority; it may retain/convert only the minimal restart notice. A crash where no final cleanup callback ran must still yield restart-only behavior when no live owner/goal exists. Worker suspension by itself must not delete a surviving panel's task record or goal.
- Existing `activatedOrigins` worker memory is not a durable access guarantee. Reconnect must check actual access and deliberately obtained activation; do not infer a grant from the checkpoint or the loopback API host permission. Reopening the panel and clicking Retry/Continue are not new `activeTab` grants. Chrome's [activeTab documentation](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) describes same-origin access retention and revocation on other-origin navigation; always handle actual access failures conservatively.

### Acceptance and automated checks

- Deterministic SPA push/replace/back/forward and full-navigation workflows preserve the original goal without re-entry when the panel survives. Assert fresh snapshots/IDs, increasing attempt/request identity, bounded previous context, unverified navigation outcomes, and at most one step increment/request per accepted transition. Cover navigation during provider requests, inspection and popup observation; delayed old callbacks must never display or continue.
- Test authorized same-origin continuation, multi-hop redirects/loading timeout, cross-origin reactivation, protected pages, tab mismatch/return/closure and actual permission errors. Retry, panel reopen and checkpoint presence must never manufacture an activation grant or silently transfer a task.
- Test worker-port loss with a live panel retaining its exact goal versus panel document destruction losing it. Reopening must offer restart/re-entry, send nothing until re-entry/consent/activation, then start a new session at step 1/null previous context. Do not reconstruct text from checkpoint, rendered messages, URLs, old replies or inferred goals.
- Checkpoint tests cover strict validation/expiry, content-script access restrictions, minimal fields, privacy-marker omission, missing tabs, owner/revision conflicts, storage failure, delayed writes after Stop/replacement and cleanup of active/restart metadata. Preserve current popup/overlay/privacy and failed-outcome/no-progress/cancellation regressions.
- Run `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm test`, `corepack pnpm test:e2e` (including production builds), and `git diff --check`. Report exact commands/results. Headless panel-tab tests do not prove actual side-panel destruction or natural worker suspension; document those manual limits. No live model call is necessary for deterministic acceptance.

### Manual Chrome verification after approved implementation

1. Build/reload the extension and run the local API/fixtures. Submit one synthetic multi-page goal. Follow highlighted SPA and full-page links yourself. Expect the same goal and fresh guidance after each authorized continuing action; never repeat the question while panel memory survives. Inspect only fake-data requests: fresh snapshot/document identity, original goal, bounded context, no old targets/geometry and no false verification.
2. Navigate manually while a response is pending and after final guidance; expect no stale reply or unsolicited next-step loop. Use explicit Continue on the destination. Exercise redirects and loading timeouts; expect a bounded pause rather than repeated AI requests.
3. Navigate cross-origin, switch tabs and try a protected page. Expect reactivation/unsupported/owned-tab pause as appropriate. Reopening the panel or Retry alone must not gain access. After a required toolbar gesture and Continue on the owned tab, the surviving goal must still be available. Closing its tab must terminate the task.
4. Interrupt the worker with the panel still alive. Expect removed guidance and a connection pause while the original goal remains available; reconnect/reactivate if required and Continue from fresh inspection. Separately test natural suspension with DevTools detached; document observed Chrome behavior rather than assuming worker lifetime.
5. Close/destroy the panel during requests, popup observation and navigation, then reopen it. Expect only a restart notice if metadata remains, never a restored question/overlay. Re-enter the goal and consent/activate as required: expect a new task. Repeat after Stop/termination: expect no restart notice. Clear or corrupt the checkpoint using only fixture data: expect honest re-entry, not inferred task text.
6. Inspect `chrome.storage.session` during active, paused and closed-panel states and after Stop/completion. Expect only the allowed metadata, no task text/page content/old targets. Repeat existing popup, sensitive-marker, cancellation and pointer-transparent overlay checks. Inspect page/panel/worker consoles for unexpected errors.

**Gate:** The revised 6B plan was explicitly approved on 23 October 2026. The outstanding popup correction still requires its own verification; plan review alone does not verify it. After implementation, record actual evidence in `PROGRESS.md`, mark AWAITING USER VERIFICATION, and stop. No commit, push, deployment, publication or next milestone is authorized by this plan revision.

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

## Historical approval gate from the 6A checkout

Milestone 6A, including the shared highlighting correction, was verified by the user on 23 October 2026. The dynamic popup correction remains separately awaiting user verification. The user approved the revised 6B implementation with “ok , continue with 6B” on 23 October 2026. Work is limited to 6B; automated evidence and manual verification status are recorded in `PROGRESS.md`. Stop after supplying verification instructions. No commit, push, deployment, publication or milestone 7 is authorized.


## Milestone 7A — Contextual text assistant

**Status:** VERIFIED by the user, 25 October 2026. Final automated evidence and numbered Chrome steps are recorded in PROGRESS.md. No Git commit/push, deployment, publication or next milestone is authorized.

The user clarified that 6B is complete. Before coding, inspection found one clean worktree on `milestone-7A` at `79aaf6c`, while local and origin `milestone-6B` both pointed to direct descendant `109e04f`. Fast-forwarding to that existing commit resolved the discrepancy; no new commit or remote operation was performed. Keep its navigation, retained volatile goal, checkpoint owner/revision guards, storage boundary, worker reconnection and all regression tests.

Scope: ordinary top-level native Selection/Range text only, one meaningful completed selection, one compact accessible Ask ClickPilot composer and one transient response. Freeze bounded text/range before input focus. No provider request until an explicit Ask with selected-text-specific consent. Reject editable/form/hidden/inert/sensitive/unsupported selections, unknown result fields, stale identity and over-limit content. Selection and question bounds are 2,000 and 240 UTF-16 code units; text HTTP requests/responses are capped at 16 KiB actual UTF-8 bytes.

Use a good default Range rectangle, measured bubble size, viewport clamping, above/below placement and scroll/resize updates. Remove floating UI if no safe space exists. Keep a pending or completed detailed panel reply when only geometry is lost; clear it on actual invalidation, a new selection, Stop or session termination. Reuse Shadow DOM surface isolation with interactive pointer events limited to the bubble; retain guidance decorations' pointer transparency.

Add strict independently versioned text protocol 1 at POST /v1/text/explain; retain guidance protocol 3. Request carries operation explain_text, opaque session/request/page/selection identities, selectedText and question. Only selectedText and question reach Gemini. No URL, origin, title, surrounding prose, control inventory, geometry, history or screenshots. Results are a strict discriminated union: explanation requires quickExplanation (1–280) and detailedExplanation (1–2,000); clarification/unsupported require only message (1–600). Server constructs the envelope. Render as text only and validate/filter at both boundaries.

Use the existing panel port, abort/stale-result approach and backend Gemini transport/security controls. Content owns range/geometry/UI, the panel owns text requests/results, and background checks activation/tab/document/current selection and routes transport. Text assistance does not create checkpoints or guidance steps. Opening the composer ends current guidance; starting inspection/guidance ends text assistance. A plain question/result boundary can support future voice without implementing speech APIs.

Likely files: new shared text contract and extension text selection/bubble/session/view/client modules; existing content/background/panel/session wiring and overlay surface helper; API route and Gemini prompt using existing transport; deterministic API/unit/browser tests and synthetic text fixture; README/local API/plan/progress documentation. No dependencies or permissions added.

Run corepack pnpm typecheck, corepack pnpm lint, corepack pnpm test, corepack pnpm test:e2e and corepack pnpm build (Worker dry-run only), plus git diff --check. Preserve the full 6A/6B/popup/overlay suite. Tests use synthetic data and mocked providers. Verify the actual Chrome side panel manually using the numbered steps in PROGRESS.md; no passing automation is presented as real-model or actual-side-panel verification.


## Current approval gate — 7A

Milestone 7A is VERIFIED. The user confirmed all manual verification is complete. Final typecheck, lint, unit tests (92 API + 113 extension), build and full browser suite (128/128, including 6A/6B) passed. The numbered Chrome checks in PROGRESS.md are confirmed complete by the user. On 25 October 2026 the user explicitly authorized committing the scoped 7A changes and pushing milestone-7A to the configured origin. No deployment, publication, merge or next milestone is authorized.

## UX-1 — Reliability, onboarding and clear messaging

Approved by the user on 25 October 2026 with “ok approved”, following the reviewed UX-1/UX-2 plan. Work is limited to UX-1. UX-2 requires UX-1 manual verification and separate approval under AGENTS.md.

- Reproduce the worker-restart failure before fixing it. Retain only tab/origin activation intent in trusted session storage, independently recheck Chrome access, and reuse existing 6B recovery. Keep live panel goals, completed explanations and same-session unsent drafts; cancel interrupted attempts and reject late results. Use bounded connection retries plus explicit/event-driven reconnect, without idle keepalive or polling.
- Offer short first-use setup with independent, initially unchecked guidance/selected-text sharing choices. Save only versioned booleans in trusted local storage. Provide Settings, fail closed on missing/malformed/loading/failed grants, apply revocation immediately, and enforce the specific consent in the panel and background before upload. Chrome activation and AI sharing remain separate.
- Replace ordinary provider/snapshot jargon with plain recovery messages while keeping fixed error codes and existing backend diagnostics. Preserve privacy failures and genuine reactivation instructions.
- Reuse existing tests; add only focused storage/activation/consent and browser cases. Run typecheck, lint, unit tests, build, full browser suite and diff checks. Provide visual evidence and numbered actual-Chrome verification in PROGRESS.md, then stop at AWAITING USER VERIFICATION.

No dependency, permission, backend protocol, screenshot, buddy, voice, persistent conversation-history or deployment change is included. Existing DOM extraction, action observation, overlay rendering and checkpoint semantics remain in place.

UX-2 remains planned: a chat-first panel with session-only messages, a bottom composer, unified existing guidance/text presentation, Settings and a secondary Developer view. It has not been implemented.
