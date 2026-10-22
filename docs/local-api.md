# Local Gemini assistant — milestone 5B

The extension can ask Gemini one independent question, show a short answer, or highlight one observed control. It never clicks, types, submits or navigates. Mock guidance remains labelled and local. There is no history, autonomous follow-up, screenshot upload or completion verification.

## Local setup

Use Node.js 22+ and Corepack. From the project root, run `corepack pnpm install`. Create **`apps/api/.dev.vars`** in your editor:

```dotenv
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
GUIDANCE_ENABLED=true
```

The backend reads this ignored file; never put the key in extension source, a `VITE_` variable, a browser setting, a command argument or chat. Obtain a key from [Google AI Studio](https://aistudio.google.com/apikey). The model is configurable; `gemini-3.5-flash-lite` is a stable model with structured output support listed in [Google's model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite). Availability and quota depend on the API project. Check [AI Studio rate limits](https://ai.google.dev/gemini-api/docs/rate-limits); do not assume free quota or a spending cap.

Start the backend and keep its terminal open:

```sh
corepack pnpm dev:api
```

It listens at `http://127.0.0.1:8787`. Restart after changing local variables. Missing/invalid model configuration or absent key returns `provider_unavailable`; absent/false `GUIDANCE_ENABLED` returns `service_disabled`. Set `GUIDANCE_ENABLED=false` and restart to disable real calls. No provider is faked in the runnable backend. Keep the API local; hosting, deployment, authentication and durable spend/abuse controls require separate approval.

In another terminal, build the extension and serve the synthetic fixture:

```sh
corepack pnpm build
python3 -m http.server 4173 --directory tests/fixtures
```

Load or reload `apps/extension/.output/chrome-mv3` at `chrome://extensions` with Developer mode enabled. The new host permission is `http://127.0.0.1:8787/*`; Chrome may treat host grants more broadly than the configured port. All client API traffic is hard-coded to exactly `http://127.0.0.1:8787/v1/guidance/next`, redirects are rejected, and a toolbar activation remains required before observing a tab. After a service-worker restart, click the toolbar again. There are no remote API host permissions.

Open `http://127.0.0.1:4173/guidance.html`, click the ClickPilot toolbar icon, choose **AI assistant**, read the disclosure, and check **Allow this panel to send the described context to Gemini**. Consent is held only while that panel mode is open; unchecking stops the request. Ask a self-contained question. Mock mode requires no backend or consent and sends no API requests.

## Protocol 2 contract

`packages/shared/src/guidance.ts` defines strict Zod request, success, error and result schemas. Protocol 1 and its former `highlight`, `ask_clarification`, `complete` and `expectedOutcome` fields are rejected; no compatibility layer remains.

Requests use `POST /v1/guidance/next`, uncompressed UTF-8 JSON, at most 65,536 actual bytes. They contain operation `next`, UUID `sessionId`, positive safe-integer `requestId`, trimmed `userGoal` (1–240 characters), page `{url,pageKey,snapshotId}` and at most 150 unique controls `{id,role,name,context,disabled}`. IDs are ephemeral `el_###`; labels/context are at most 80 characters. HTTP requests no longer include geometry or viewport. Unknown fields, HTML, values, screenshots, secrets, actions and selectors are rejected.

Success envelopes contain `{protocolVersion:2,sessionId,requestId,pageKey,snapshotId,result}`. Only the server supplies identity. Gemini supplies exactly one result:

| Result | Exact fields |
|---|---|
| `guidance` | `kind`, `message` (1–600), observed `targetId`, `instruction` (1–160) |
| `answer` | `kind`, `message` (1–600) |
| `clarification` | `kind`, `message` (1–600) |
| `unsupported` | `kind`, `message` (1–600) |

Text is trimmed and rendered using React text children and existing tooltip `textContent`. HTML/Markdown-looking text stays literal; there is no markup renderer or automatic linkification. No result proves completion. Only guidance can carry a target. Zod validates output on the backend and extension; filtered IDs, disabled controls, unknown IDs and stale identities are refused. The content script reuses its registry and live visibility, coverage, enabled-state, URL and geometry checks. A guidance narrative is shown only after the highlight succeeds. A valid but unavailable target can trigger one fresh observation/request, then guidance pauses. Invalid model output is an error, not an invitation to invent IDs.

Text-only results never call the overlay renderer. Previous runs are cancelled and cleared before fresh observation. Text replies remain tied to their snapshot, so navigation, tab switches, expiry and disconnection also invalidate them. A trusted matching user click only acknowledges the click; it never asks Gemini for another step.

## Privacy and runtime boundaries

The background obtains the current local snapshot and actual active-tab URL, checks sensitive routes/credential URLs/goals, and minimizes before upload. It sends only the current question, site origin, filtered visible control labels/context and envelope IDs to the local API. URL paths, queries/fragments, geometry, viewport, disabled/unnamed/sensitive-looking controls and prior questions are omitted. The backend filters again and forwards only the question, origin and eligible IDs/roles/labels/context; session/page/snapshot IDs never reach Gemini. DOM extraction has not expanded to page prose or field values.

Filtering is heuristic and cannot guarantee arbitrary labels contain no personal information. Use public non-sensitive pages and synthetic data for verification. Google's [Gemini API terms](https://ai.google.dev/gemini-api/terms) distinguish paid/unpaid data handling; unpaid inputs/outputs may be used to improve Google products. The panel discloses this before consent. No request/model bodies, keys, screenshots or sensitive DOM content are logged by application code.

The backend uses direct `generateContent` REST, a bounded JSON schema and strict Zod validation, no tools/history/SDK. [Google's structured-output guide](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) describes supported `anyOf` schemas; schema enforcement is followed by local grounding checks. Upstream redirects are not followed (`manual`, supported by Workers); non-2xx responses are safe errors. Google responses are streamed with a 32 KiB cap; API replies have an 8 KiB client cap. Truncated/blocked/malformed results are rejected. Provider timeout is 20 seconds, extension request timeout 25 seconds, with abort propagation on Stop/replacement/disconnection. Wrangler enables [`enable_request_signal`](https://developers.cloudflare.com/changelog/post/2025-05-22-handle-request-cancellation/) so incoming disconnects can cancel upstream work. Provider processing already accepted before cancellation may still consume quota.

Errors use protocol 2 `{kind:'error',error:{code,message}}` with fixed safe text, no raw provider bodies or validation internals. Codes cover validation/media/size/privacy errors, disabled/unconfigured service (503), provider failure/invalid reply (502), rate limit (429), timeout (504), cancellation (499), invalid routes/methods and local-only restrictions. Responses have `Cache-Control:no-store` and `X-Content-Type-Options:nosniff`. No CORS grant is supplied. Loopback checks and lack of CORS are not public authentication.

## Checks and real smoke tests

```sh
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm test:e2e
```

`test:e2e` includes extension and Worker dry-run builds. Wrangler's `deploy --dry-run` bundle-size label does not mean a deployment occurred. Browser tests substitute panel HTML in a tab for the actual Chrome side panel; perform the manual checks below too.

With the local Worker running:

```sh
corepack pnpm verify:api
corepack pnpm --filter @clickpilot/api smoke:gemini
```

`verify:api` checks five invalid-request cases and never calls Gemini, even with credentials configured. `smoke:gemini` intentionally makes four real, potentially billable calls with synthetic controls only, expecting guidance, answer, clarification and unsupported. It validates protocol/identity/targets and prints only outcomes, not text or secrets. It stops on the first failure. Do not run the real Worker concurrently with assistant browser tests: those tests bind a **mock API** to port 8787. Unit/provider tests also mock fetch; passing them says nothing about live model availability or accuracy. See `PROGRESS.md` for exact results and limitations.

## Manual Chrome verification

1. Complete setup above. Before consent, **Ask Gemini** must be disabled. Submitting without clicking the toolbar must ask you to activate the tab. No observation or upload should occur.
2. Ask **“Show me the Primary target button.”** Expect a short panel explanation, the Primary target highlight, and a separate short tooltip. The fixture must still say **Clicks: 0**. Scroll/resize: geometry follows or clears when unavailable; clicks pass through. Click Primary target yourself: expect an unverified click acknowledgement, overlay removal and no new model call.
3. Submit **“Explain what a navigation menu is in general; no highlight needed.”** Expect a useful short answer and no old/new overlay. Then ask **“Find Settings.”** Expect clarification between the duplicate controls. Ask **“Tell me my account balance from this page.”** Expect an honest limitation. Model wording varies; an answer must never claim to have performed an action. Clarify by submitting a new standalone question, e.g. **“Find Settings in Main navigation.”**
4. In the extension service-worker DevTools Network panel, inspect a synthetic request to port 8787. Expect only protocol 2, current question, origin, envelope IDs and eligible label inventory; no path/query/hash, geometry, values, screenshots, history or key. Use only fake data. The backend-to-Google request is covered by deterministic tests; it omits envelope IDs too. Do not share DevTools captures containing real credentials.
5. Ask again and immediately Stop, replace the question, navigate via **Change route (SPA)**, switch tabs or close the side panel; repeat for text questions and guidance. Expect no late reply/highlight. Reload the fixture and click the toolbar to recover. Unchecking consent must stop pending work. Answers already displayed must clear on navigation. Covered/removed/disabled targets must clear or cause at most one target refresh.
6. Stop the backend, submit a question and expect a connection error with working Stop/Retry. Restart and Retry. Set `GUIDANCE_ENABLED=false`, restart, and expect **service disabled**, never a fake answer; restore `true` afterward. **Mock guidance** must still work with the backend stopped. Invalid output, byte bounds, timeout, quota and late-result races are reproducibly exercised by the mocked tests rather than forcing your real account to exhaust quota.

Report any stale text, guessed target, executed markup, blocked webpage interaction, unintended upload or automatic action as a failure. The user has verified milestone 5B and authorized its branch commit/push. Deployment and milestone 6A still require separate permission.
