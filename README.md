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

The milestone 1 foundation is ready for Chrome verification. Use Node.js 22 or newer and Corepack, then run these commands from the project root:

```sh
corepack pnpm install
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
```

To load the built extension, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `apps/extension/.output/chrome-mv3`. Open an ordinary website and click the ClickPilot toolbar icon. The side panel should show the foundation screen. If it does not open, inspect **Errors** on the extension card and the service worker console from **Inspect views**. Reload the unpacked extension after each rebuild.

This build opens the side panel only. It does not observe pages or provide guidance yet. The generated manifest requests `activeTab` for future toolbar-activated page access and `sidePanel` for Chrome's side-panel API; it has no host permissions. WXT adds `sidePanel` when it detects the side-panel entrypoint.

Development uses `AGENTS.md` for coding guidelines, `docs/clickpilot-production-architecture.md` for system design, `PLAN.md` for milestones, and `PROGRESS.md` for verification status.

## Quality goals

The initial test plan will measure target-identification accuracy, guided-workflow completion, correct overlay placement, safe recovery, and privacy behavior. Aspirational targets are **90% correct target selection** and **80% successful guided workflows** on a clearly documented test set. These are **goals, not achieved results**.

## Why this project?

ClickPilot explores a practical intersection of browser extension development, AI-assisted reasoning, DOM analysis, frontend rendering, API design, runtime validation, and reliable state management. The focus is not on building another chatbot: it is on turning a question about the current webpage into **clear, visual, user-controlled guidance**.

## License

To be decided before public release.
