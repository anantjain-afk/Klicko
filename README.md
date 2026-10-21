# ClickPilot

**An AI-powered visual guide for your browser.**

ClickPilot is a Chrome extension that helps people learn how to use unfamiliar websites. Ask a question about the page you're viewing, and ClickPilot identifies the relevant on-screen control, highlights it, and guides you through the task **one step at a time**.

> **Project status:** Planned / in development. This README describes the intended MVP, not features that are already implemented.

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
    |        (permissions, tab events, screenshots, routing)
    |
    +---- Content Script
    |        (DOM snapshot, element registry, overlays, verification)
    |
    v
Cloudflare Worker API (Hono + Zod)
    |
    v
Gemini API (page understanding and structured next-step response)
    |
    v
Validated target ID -> Content Script -> On-page visual guidance
```

**DOM-first, screenshot-assisted:** The extension sends only relevant, filtered page context by default. Screenshots are a fallback, not a requirement for every question.

**One step at a time:** The AI proposes the next grounded action based on the *current* page rather than guessing an entire future workflow.

**Resilient extension state:** Session checkpoints can be stored with Chrome's session storage so an MV3 service-worker restart does not automatically lose the active workflow. Restored targets must be revalidated.

## Planned technology stack

| Area | Technology |
| --- | --- |
| Extension framework | WXT, Chrome Manifest V3 |
| UI | React, TypeScript, plain CSS |
| Browser integration | Chrome extension APIs, content scripts, Shadow DOM, SVG |
| Backend | Cloudflare Workers, Hono |
| AI | Google Gemini API (free-tier eligible models, subject to quotas) |
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
5. **AI integration:** Add a validated backend endpoint and Gemini-based target selection.
6. **Multi-step guidance:** Verify user actions, handle navigation, and recover from stale targets.
7. **Screenshot fallback:** Add opt-in visual reasoning when necessary.
8. **Hardening and release:** Security review, browser tests, documentation, and demo.

Each milestone requires automated checks **and manual verification in Chrome** before work proceeds.

## Privacy and safety principles

- Access the current tab only with appropriate user-granted permissions.
- Avoid collecting input values, passwords, tokens, payment details, and unrelated private content.
- Keep screenshots opt-in and avoid storing them on the backend.
- Keep the Gemini API key on the backend, never in the extension bundle.
- Treat webpage text as untrusted data, not instructions to the assistant.
- Validate AI output and confirm the selected target against the current DOM.
- Never automate user clicks, typing, or form submissions.

## Local development

Milestone 4 adds local, mocked single-step guidance alongside manual inspection and highlights. Use Node.js 22 or newer and Corepack, then run these commands from the project root:

```sh
corepack pnpm install
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

To load the built extension, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `apps/extension/.output/chrome-mv3`. Reload the unpacked extension after each rebuild. If the panel fails, inspect **Errors** on the extension card and the service worker console from **Inspect views**.

Start `python3 -m http.server 4173 --directory tests/fixtures` in a separate terminal and open `http://127.0.0.1:4173/guidance.html`. Click the ClickPilot toolbar icon **on that tab**. In the default **Mock guidance** view, enter **find primary target** and choose **Start mock guidance**. Expect a highlight and a waiting state. The page counter stays at zero until you click the target yourself. After your click, the panel acknowledges it and explicitly says the task has not been verified complete.

Supported mock tasks are **find primary target**, **find profile**, **open help**, **find navigation settings**, and **find dialog settings**. **Find settings** deliberately asks for clarification because the fixture has two Settings buttons. Unknown tasks and missing controls produce honest limitations. This is a fixed local selector, not natural-language AI; it only runs on `/guidance.html` over HTTP at `127.0.0.1:4173` or `localhost:4173`. Typed questions and page details remain in the extension.

Use **Stop** to cancel and remove guidance. **Replace guidance** submits a new task and cancels the old one. **Retry** starts the last submitted task and scenario again using fresh observation. Under **Mock test scenarios**, choose Normal, Delay selection by 2 seconds, Stale target once then recover, Stale target on both attempts, or Invalid mock output. A stale target gets at most one automatic refresh; persistent failure pauses. Retry repeats the previous scenario, so change the dropdown and submit again to test a different behavior. Navigating, switching tabs, closing the panel, changing modes, or losing a target cancels the current run. There is no resume after panel closure.

To check extraction separately, choose **Manual highlights** and open `http://127.0.0.1:4173`. Activate the toolbar there, then choose **Inspect this page**. The list should show visible controls such as Profile, Next page, two Settings buttons in different contexts, Open help, Unavailable, and Search projects. It should omit the hidden button, password field, typed values, and editable content. Clicking **Stop** removes the list and any overlay. Click the fixture's **Next page** link to verify that the old list clears and the new page produces a different list. A cross-origin navigation may end the temporary access; click the toolbar icon on the new tab before inspecting again.

For manual overlays, stay in **Manual highlights**, open `http://127.0.0.1:4173/overlay.html`, activate the toolbar there, and inspect it. Choose **Highlight** beside Primary target. Expect a green outline, arrow, and tooltip; click the target yourself to increment the fixture counter. Try Move target, manual scrolling, browser zoom, resizing, Hide/Remove/Cover target, SPA navigation, Stop, and closing the panel. Reload and inspect between destructive checks. Full numbered verification steps are in `PROGRESS.md`; the recorded 20-case automated matrix is in `docs/overlay-test-matrix.md`.

Both modes wait for you. Neither verifies task completion, clicks, types, or sends page details to an AI service. The mock acknowledges only trusted browser click events on the selected target or its descendants; synthetic page-script clicks are ignored. Its manifest requests `activeTab`, `scripting`, and `sidePanel`; it has no host permissions or always-on content scripts. `scripting` lets the background worker inject the observer only after toolbar activation. The page registry expires after one minute and clears with Stop, navigation, or panel disconnection. Reinspect or Retry to renew it. Each overlay frame resolves the live element and checks visibility, coverage, and current page/snapshot identity; it never scrolls the target into view. Disabled, clipped, offscreen, covered, or unplaceable targets are rejected or removed. The content script uses a Shadow DOM, CSS pixels, and literal text for the tooltip, with pointer-transparent decorations.

Support remains limited to top-level ordinary DOM controls. Iframes, shadow-tree targets, and canvas targets are excluded. Hit testing samples the center and corners; it does not prove every pixel is unobstructed. Browser top-layer modals/popovers and unusual page transforms may hide decoration; these need site-specific verification. Actual Chrome/Brave side-panel lifecycle behavior remains a manual check.

The unit checks run with `corepack pnpm test`. To run the Playwright checks, first run `corepack pnpm exec playwright install chromium --no-shell`, then `corepack pnpm test:e2e`. These checks cover restricted-page handling, toolbar-activated fixture inspection, the overlay matrix, and mocked guidance in Chromium. The guidance tests cover ambiguity, unsupported pages/tasks, missing targets, delayed selection, replacement, Stop/Retry, bounded recovery, invalid mock output, navigation, trusted clicks, mode changes, and panel closure. The headless tests open the panel HTML in a tab; use the manual steps in `PROGRESS.md` to verify the actual side panel in Chrome and Brave.

Development uses `AGENTS.md` for coding guidelines, `docs/clickpilot-production-architecture.md` for system design, `PLAN.md` for milestones, and `PROGRESS.md` for verification status.

### Local API (milestone 5A)

Run `corepack pnpm dev:api` to start the local Worker at `http://127.0.0.1:8787`. In another terminal, run `corepack pnpm verify:api` for six synthetic HTTP checks. Valid requests return **503 provider_unavailable**; no AI provider is configured. The extension continues to use its local Mock guidance and makes no backend requests. No key, login, deployment, or extra extension permission is needed.

The new `apps/api` workspace uses Hono for routing and the `packages/shared` Zod schemas for bounded input/output validation, privacy filtering, and target membership checks. Root typecheck/lint/test/build commands now include these workspaces. The API build uses Wrangler's explicit `--dry-run` flag and does not deploy. See [local API setup and contract](docs/local-api.md) for the request fixture, curl command, validation limits, expected errors, and known privacy limitations.

## Quality goals

The initial test plan will measure target-identification accuracy, guided-workflow completion, correct overlay placement, safe recovery, and privacy behavior. Aspirational targets are **90% correct target selection** and **80% successful guided workflows** on a clearly documented test set. These are **goals, not achieved results**.

## Why this project?

ClickPilot explores a practical intersection of browser extension development, AI-assisted reasoning, DOM analysis, frontend rendering, API design, runtime validation, and reliable state management. The focus is not on building another chatbot: it is on turning a question about the current webpage into **clear, visual, user-controlled guidance**.

## License

To be decided before public release.
