# ClickPilot

**An AI-powered visual guide for your browser.**

ClickPilot is a Chrome extension that helps people learn how to use unfamiliar websites. Ask a question about the page you're viewing, and ClickPilot identifies the relevant on-screen control, highlights it, and guides you through the task **one step at a time**.

> **Project status:** The extension is in development. The current AI path uses a provider, model, and API key saved by each user; public distribution has not been approved.

## The problem

Finding a setting or completing an unfamiliar workflow often means switching between a website and tutorials. Instructions can be outdated or difficult to map to the current interface.

ClickPilot aims to provide guidance directly on the webpage you're using, without taking control of your browser.

## How it works

For example, while viewing a Vercel project dashboard, you ask:

> How do I connect my custom domain?

ClickPilot will aim to:

1. Read a **compact DOM snapshot** of the current page (visible buttons, links, labels, and relevant context).
2. Send your question and the filtered page context to an AI model.
3. Receive a structured response pointing to an element that exists in the snapshot.
4. Validate that the element still exists and draw a highlight, arrow, and short instruction.
5. Wait for **you** to click; then observe and verify the result before guiding the next step.
6. Request explicit consent for a screenshot if DOM information alone is insufficient.

**ClickPilot does not automatically click, type, or submit forms.** You remain in control.

## Planned MVP features

- Chrome extension with a React side panel for questions and progress.
- On-demand analysis of the active tab, using a compact DOM snapshot.
- AI-selected targets backed by real page element IDs.
- Visual highlights, arrows, and contextual tooltips.
- Step-by-step guidance with user-action verification and recovery.
- Optional, consent-based screenshot assistance for visually complex pages.
- Clear permission, loading, unsupported-page, and error states.

### Initial scope and limitations

The first release focuses on **Chrome and ordinary HTML/React websites**. Complex canvases, cross-origin frames, browser-internal pages, and heavily customized interfaces may not be supported. Guidance can be incorrect; the extension must fail safely when it cannot identify a trustworthy target.

## Architecture

```text
User in Chrome
    |
    v
React Side Panel (question, progress, consent)
    |
    +---- Chrome MV3 Service Worker
    |        (permissions, tab events, provider requests)
    |
    +---- Content Script
    |        (DOM snapshot, element registry, overlays, verification)
    |
    v
Chosen provider API (Gemini, OpenAI, or Groq)
    |
    v
Validated target ID -> Content Script -> On-page visual guidance
```

**DOM-first, screenshot-assisted:** The extension sends only relevant, filtered page context by default. Screenshots are a fallback, not a requirement for every question.

**One step at a time:** The AI proposes the next grounded action based on the *current* page rather than guessing an entire future workflow.

**Resilient extension state:** The live side panel owns the goal. Navigation and worker disconnection discard page state while retaining that goal. Chrome session storage holds only interruption metadata; reopening a destroyed panel requires entering the goal again. Recovery always inspects fresh controls.

## Planned technology stack

| Area | Technology |
| --- | --- |
| Extension framework | WXT, Chrome Manifest V3 |
| UI | React, TypeScript, plain CSS |
| Browser integration | Chrome extension APIs, content scripts, Shadow DOM, SVG |
| Local legacy API | Cloudflare Workers, Hono (development only) |
| AI | User-selected Gemini, OpenAI, or Groq model |
| Validation | Zod |
| Local state | Chrome Storage API |
| Testing | Vitest, Playwright |

The MVP does **not** require a database, user accounts, Redis, or an autonomous browsing agent. The design aims to stay within free tiers during development, but API limits and service pricing can change.

## Development roadmap

The project will be built and verified in small milestones:

1. **Extension foundation:** WXT setup, side panel, and minimum permissions.
2. **DOM extraction:** Gather useful visible elements and assign temporary IDs.
3. **Overlay engine:** Draw and reposition highlights, arrows, and tooltips.
4. **Mock guidance:** Test the complete interaction loop without an AI API.
5. **AI integration:** Add a validated local Gemini endpoint, then user-selected direct provider access.
6. **Multi-step guidance:** Verify user actions, handle navigation, and recover from stale targets.
7. **Screenshot fallback:** Add opt-in visual reasoning when necessary.
8. **Hardening and release:** Security review, browser tests, documentation, and demo.

Each milestone requires automated checks **and manual verification in Chrome** before work proceeds.

## Privacy and safety principles

- Access supported tabs only with the appropriate user-granted permissions.
- Avoid collecting input values, passwords, tokens, payment details, and unrelated private content.
- Keep screenshots opt-in and avoid storing them on the backend.
- Keep user-supplied API keys out of the extension bundle, webpage messages, and logs. Saved keys remain on this device in Chrome extension storage, which is not encrypted.
- Treat webpage text as untrusted data, not instructions to the assistant.
- Validate AI output and confirm the selected target against the current DOM.
- Never automate user clicks, typing, or form submissions.

## Local development

The extension includes local mocked guidance, manual inspection, and user-selected AI guidance. Use Node.js 22 or newer and Corepack, then run these commands from the project root:

```sh
corepack pnpm install
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

To load the built extension, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `apps/extension/.output/chrome-mv3`. Reload the unpacked extension after each rebuild. If the panel fails, inspect **Errors** on the extension card and the service worker console from **Inspect views**.

To prepare the downloadable Chrome ZIP for the website, run `corepack pnpm package:extension` from the repository root. This uses WXT to build and zip the extension, then copies the archive to `website/public/downloads/klicko-chromium.zip`. On the website, download and extract it, then load the extracted folder containing `manifest.json` using **Load unpacked**. The ZIP contains no API key; each user configures their own provider in extension Settings. Packaging does not deploy the website or publish the extension.

Start `python3 -m http.server 4173 --directory tests/fixtures` in a separate terminal and open `http://127.0.0.1:4173/guidance.html`. Turn ClickPilot on with the toolbar if it is not already on. Open the buddy’s sidebar, choose **More options → Developer tools → Mock guidance**, enter **find primary target** and choose **Start mock guidance**. Expect a highlight and a waiting state. The page counter stays at zero until you click the target yourself. After your click, the panel acknowledges it and explicitly says the task has not been verified complete.

Supported mock tasks are **find primary target**, **find profile**, **open help**, **find navigation settings**, and **find dialog settings**. **Find settings** deliberately asks for clarification because the fixture has two Settings buttons. Unknown tasks and missing controls produce honest limitations. This is a fixed local selector, not natural-language AI; it only runs on `/guidance.html` over HTTP at `127.0.0.1:4173` or `localhost:4173`. Typed questions and page details remain in the extension.

Use **Stop** to cancel and remove guidance. **Replace guidance** submits a new task and cancels the old one. **Retry** starts the last submitted task and scenario again using fresh observation. Under **Mock test scenarios**, choose Normal, Delay selection by 2 seconds, Stale target once then recover, Stale target on both attempts, or Invalid mock output. A stale target gets at most one automatic refresh; persistent failure pauses. Retry repeats the previous scenario, so change the dropdown and submit again to test a different behavior. Navigating, switching tabs, closing the panel, changing modes, or losing a target cancels the current run. There is no resume after panel closure.

To check extraction separately, choose **Manual highlights** and open `http://127.0.0.1:4173`. Make sure ClickPilot is enabled for that tab, then choose **Inspect this page**. The list should show visible controls such as Profile, Next page, two Settings buttons in different contexts, Open help, Unavailable, and Search projects. It should omit the hidden button, password field, typed values, and editable content. Clicking **Stop** removes the list and any overlay. Click the fixture's **Next page** link to verify that the old list clears and the new page produces a different list. In current-tab fallback mode, a cross-origin navigation can end temporary access; activate the toolbar on the destination before inspecting again.

For manual overlays, stay in **Manual highlights**, open `http://127.0.0.1:4173/overlay.html`, make sure ClickPilot is enabled, and inspect it. Choose **Highlight** beside Primary target. Expect a green outline, arrow, and tooltip; click the target yourself to increment the fixture counter. Try Move target, manual scrolling, browser zoom, resizing, Hide/Remove/Cover target, SPA navigation, Stop, and closing the panel. Reload and inspect between destructive checks. Full numbered verification steps are in `PROGRESS.md`; the recorded 20-case automated matrix is in `docs/overlay-test-matrix.md`.

Both local modes wait for you. Neither verifies task completion, clicks, types, or sends page details to an AI service. The mock acknowledges only trusted browser click events on the selected target or its descendants; synthetic page-script clicks are ignored. The manifest requests `activeTab`, `scripting`, `sidePanel`, `storage`, and `offscreen`, plus optional HTTP/HTTPS site access; it has no always-on content scripts or required API host grant. `scripting` lets the background worker inject the observer only after toolbar activation. The page registry expires after one minute and clears with Stop, navigation, or panel disconnection. Reinspect or Retry to renew it. Each overlay frame resolves the live element and checks visibility, coverage, and current page/snapshot identity; it never scrolls the target into view. Disabled, clipped, offscreen, covered, or unplaceable targets are rejected or removed. The content script uses a Shadow DOM, CSS pixels, and literal text for the tooltip, with pointer-transparent decorations.

Support remains limited to top-level ordinary DOM controls. Iframes, shadow-tree targets, and canvas targets are excluded. Hit testing samples the center and corners; it does not prove every pixel is unobstructed. Browser top-layer modals/popovers and unusual page transforms may hide decoration; these need site-specific verification. Actual Chrome/Brave side-panel lifecycle behavior remains a manual check.

The unit checks run with `corepack pnpm test`. To run the Playwright checks, first run `corepack pnpm exec playwright install chromium --no-shell`, then `corepack pnpm test:e2e`. These checks cover restricted-page handling, toolbar-activated fixture inspection, the overlay matrix, and mocked guidance in Chromium. The guidance tests cover ambiguity, unsupported pages/tasks, missing targets, delayed selection, replacement, Stop/Retry, bounded recovery, invalid mock output, navigation, trusted clicks, mode changes, and panel closure. The headless tests open the panel HTML in a tab; use the manual steps in `PROGRESS.md` to verify the actual side panel in Chrome and Brave.

Development uses `AGENTS.md` for coding guidelines, `docs/clickpilot-production-architecture.md` for system design, `PLAN.md` for milestones, and `PROGRESS.md` for verification status.

### AI provider settings (current extension path)

Open the extension's **Settings** (or first-use setup). Choose **Google Gemini**, **OpenAI**, or **Groq**, choose a listed model, paste your own API key, and select **Save provider**. Chrome asks for access to that provider's API origin if it has not already been granted. Each provider's key and model are saved separately in trusted extension storage. Switching back restores that provider's model and uses its saved key; leaving the key field blank keeps it. Only the selected provider receives requests, with its key in an HTTPS request header. **Remove saved key** removes only the selected provider's key. Saved keys and models persist across browser restarts, but uninstalling the extension clears local storage. Chrome extension storage is not encrypted; protect your device and browser profile. Provider availability, quotas, billing, and data handling depend on your own account. Webpage guidance and selected-text sharing still need their separate consent choices.

No local API server is needed for this path. The model sees a filtered site origin and visible control labels for guidance, or the selected passage and question for text help. Screenshots and input values are not sent. Model output is validated and grounded against current page elements before highlighting. No real provider call is made by the automated tests; verify each provider with your own key on synthetic public fixtures in Chrome.

### Historical local Gemini assistant (milestone 6A)

The following setup describes the retained local development API. The current extension no longer calls this endpoint; use the provider settings above for live guidance.

The original AI integration sent filtered controls through a local Worker to Gemini. Its request contract and development tests remain in `apps/api`; the current extension uses the direct provider path described above. Guidance still uses `nextStep: "none" | "after_user_action"`, validates every returned target against current page state, and never treats a click as proof of task completion. **Mock guidance** remains a separate local mode.

For the historical Worker setup and protocol 3 contract, see [local API development notes](docs/local-api.md). That Worker can be run and tested separately, but it is not part of current extension setup.

`corepack pnpm verify:api` runs negative local HTTP checks without Gemini. `corepack pnpm --filter @clickpilot/api smoke:gemini` intentionally makes real synthetic Gemini calls and may incur usage charges. Extension provider browser checks mock all three remote APIs and do not measure model accuracy.

The retained Worker uses Hono and Zod with a backend-only Gemini secret. Worker builds use `--dry-run`; nothing is deployed. The current extension requests provider access when a user saves their selection and keeps user-supplied keys out of its bundle. Hosting remains unapproved.

Try the synthetic three-step task at `http://127.0.0.1:4173/multistep.html`; follow the numbered multi-step Chrome checks in [docs/local-api.md](docs/local-api.md). Retry keeps the current step; Continue manually records your confirmation. Confirm task complete explicitly ends the task based on your confirmation. The per-tab task can continue while the sidebar is closed; see the recovery checks below.

### Navigation and interruption recovery

Each task stays bound to its own tab. A trusted continuing link can lead to a fresh, settled snapshot on the destination. Manual navigation, a tab change, uncertain recovery or a failed objective check requires the user to choose Continue. Global host access covers supported cross-origin destinations; current-tab fallback may require a new toolbar gesture after cross-origin navigation. Chrome access is always checked again.

Trusted `chrome.storage.session` stores a bounded, privacy-filtered per-tab recovery record with the original goal, last-step context, optional short reply summary, identifiers and a 30-minute expiry. It does not store snapshots, selected passages, full URLs, input values or full conversation history. Worker restart restores the task paused; Continue inspects the current page again and never replays an interrupted request. Stop, completion, consent withdrawal and tab closure clear the task record. The sidebar and buddy subscribe to the same per-tab task, so closing the sidebar does not itself terminate it.

For a synthetic navigation task, serve `tests/fixtures`, open `http://127.0.0.1:4173/navigation.html`, enable ClickPilot, consent to webpage guidance and ask **Change a Vercel domain**. Follow Settings → Domains → Edit domain yourself. Repeat with `navigation.html?full` for document replacement. Model choices can vary; automated tests use isolated mocked replies. Numbered checks, actual test evidence and limits are recorded in [PROGRESS.md](PROGRESS.md).

## Quality goals

The initial test plan will measure target-identification accuracy, guided-workflow completion, correct overlay placement, safe recovery, and privacy behavior. Aspirational targets are **90% correct target selection** and **80% successful guided workflows** on a clearly documented test set. These are **goals, not achieved results**.

## Why this project?

ClickPilot explores a practical intersection of browser extension development, AI-assisted reasoning, DOM analysis, frontend rendering, API design, runtime validation, and reliable state management. The focus is not on building another chatbot: it is on turning a question about the current webpage into **clear, visual, user-controlled guidance**.

## License

To be decided before public release.


### Global toolbar activation

Click the toolbar once to enable ClickPilot for all currently open supported HTTP/HTTPS tabs and newly loaded webpages. On first enable, Chrome asks for optional all-site host access (`http://*/*`, `https://*/*`). This permission lets ClickPilot show its local buddy and existing selection bubble without a separate toolbar click per tab. It does not enable AI sharing: only an explicit question with the existing category consent can upload sanitized context. Tasks remain independent per tab; switching tabs pauses guidance.

Click the toolbar again to turn ClickPilot off globally, cancel pending work and remove buddy, selection and highlighting UI everywhere. The ON flag lives in trusted `storage.session`: it survives service-worker suspension, and starts OFF in a new browser session. The Chrome host grant can remain available for the next deliberate enable. No keepalive is used.

If all-site access is denied, the same toolbar gesture can activate just the current supported tab using Chrome’s temporary `activeTab` grant. The toolbar shows **TAB**, and the buddy explains the limitation. Use the toolbar to retry global mode, or **Hide ClickPilot** to dismiss the fallback on that tab. Cross-origin access loss removes local UI and pauses the task until access is explicitly regained. Revoking all-site access turns global mode off and removes its UI. Restricted browser/store pages and the existing sensitive-page exclusions remain unsupported.

Chrome controls the native permission dialog; see [optional permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions). Headless regression tests exercise denial and a disposable build with host access pregranted; native prompt acceptance and real revocation require the manual steps in `PROGRESS.md`. The global and selection behavior in this section supersedes older milestone descriptions below.

### Contextual text assistant (7A)

Turn ClickPilot on with the toolbar. On a supported, permitted page, select a short ordinary passage, choose **Ask ClickPilot**, and enter a question; the sidebar can stay closed. Enable **Selected-text assistance** during first-use setup or in **Settings** before pressing **Ask**. Selection and drafting stay local. A short explanation appears beside the selection and its detailed answer is shared with the sidebar. Starting guidance, Stop, Done and New chat cancel conflicting work while keeping selection available. Explicit **Stop text assistant**, deactivation, navigation or access loss stop that document’s listener. Switching tabs cancels pending selection work; returning allows a fresh selection. Closing the sidebar or worker suspension does not disable local detection. A valid unsent draft may survive in the same document; a pending request is never replayed after recovery.

Use public, non-sensitive text only. Editable fields, forms, sensitive contexts and unsupported frames/shadow/PDF/canvas selections are excluded. Limits: 2,000 passage characters and 240 question characters; privacy filters are heuristic. Only the selected passage and question reach the chosen provider. No screenshots, voice, conversation history or persistent selected text are added. See `docs/local-api.md` for the historical text contract and `PROGRESS.md` for verification status and Chrome steps.

### Reliability and remembered sharing (UX-1)

First-use setup explains provider sharing and offers two optional, initially unchecked choices: **Webpage guidance** and **Selected-text assistance**. Save choices even with both off to use local tools. Settings lets you change either choice; turning one off stops that assistance and prevents subsequent uploads. A request already sent may have reached the chosen provider. Preferences are versioned and stored in trusted `chrome.storage.local['clickpilot.ai-sharing']`; the selected provider is stored under `clickpilot.active-provider` and each saved model/key under `clickpilot.provider.<provider>`. No task text, selected passages or responses are stored there. Existing per-panel consents are not silently migrated into opt-in.

Chrome toolbar activation remains separate from AI consent. In current-tab fallback mode, trusted `chrome.storage.session` records the activated tab and origin, rechecks actual scripting access, and removes the record when access is lost. Global mode additionally uses the optional all-site host grant and a session-scoped ON flag. These records confer no browser permission. No heartbeat or persistent chat history is used.

The shared per-tab task reconnects after temporary worker loss and rejects interrupted replies. Continue obtains fresh page context instead of replaying an old request. A valid unsent floating text draft can remain in its original document; Stop and consent withdrawal discard it. A filtered per-tab task goal and short reply summary can survive in trusted session storage, while selected text and the full conversation are not persisted. Focusing the panel or buddy retries a disconnected connection.

### Minimal chat sidebar (UX-2)

The side panel now opens directly to chat: type in the bottom composer and press Enter or Send (Shift+Enter adds a line). Current guidance shows only the actions it needs: Stop, Retry, Continue and Done. Selected-text questions and explanations appear in the same conversation while the existing webpage selection composer remains available.

The top-right More options menu contains New chat, Settings, Text selection and Developer tools. Settings holds the remembered sharing choices. Text selection shows controls for the existing selection assistant, which is automatically available while ClickPilot is enabled. Manual Highlights and Mock guidance live in Developer tools; starting a tool ends active guidance. Back to chat keeps the conversation and draft. New chat stops active assistance and clears that panel’s messages.

Messages exist only in the live panel document and are never added to model requests or storage. A new question still starts a separate task using the existing minimized context; visible history does not create AI memory. UX-2 awaits manual Chrome verification. At the user’s request no automated tests were added or run for the UI redesign.

### Animated companion

The approved yellow/graphite Rive robot is integrated into the floating buddy and sidebar, with cursor attention, curious typing reactions, task expressions and Motion movement. The sidebar robot peeks over the workspace edge. Integration awaits manual Chrome verification; existing task/consent behavior remains in place.

Build with `corepack pnpm --filter @clickpilot/extension build`, then reload `apps/extension/.output/chrome-mv3` in Chrome. See [companion animation](docs/companion-animation.md) for asset preparation, runtime boundaries, editing, checks and limitations. The standalone [character playground](prototypes/robot-playground/README.md) remains available for visual iteration.

Interaction sounds use the supplied local WAV files, including separate `boing-1` normal replies and `boing-2` selected-text replies. A small offscreen audio page handles launch/close playback reliably at 50% volume. See [sound mappings and implementation](docs/interaction-sounds.md).
