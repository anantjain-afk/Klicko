ClickPilot — Codex Agent Instructions
Mission
Build ClickPilot, a Chrome Manifest V3 extension that guides users visually through websites. Users ask a question; the extension observes the permitted page, highlights the next relevant element, and waits for the user to act. Never automatically click, type, submit, or navigate on behalf of the user.
Highest priority: simple, organized, understandable code
- Prefer the simplest correct solution. Do not introduce abstractions for hypothetical future requirements.
- Write readable TypeScript that a JavaScript/React developer can understand. Avoid clever patterns, advanced generics, metaprogramming, and unnecessary design patterns.
- Use clear names, small functions, early returns, and straightforward control flow. Comments should explain why, not narrate obvious code.
- Keep related code together; split files by genuine responsibility, not by arbitrary size or one-function-per-file rules.
- Avoid giant components, deeply nested conditionals, duplicated logic, circular imports, and hidden side effects.
- Prefer built-in browser APIs and existing dependencies over adding packages. Before adding a dependency, explain its purpose and why existing tools are insufficient.
- Do not add databases, authentication, Redis, queues, microservices, agent frameworks, analytics, or elaborate architecture without explicit approval.
- Do not rewrite working modules or refactor unrelated files while implementing a milestone.
- Do not leave placeholder implementations, mock success responses presented as real, or unexplained TODOs.
Stack and boundaries
- WXT, React, TypeScript (strict), Chrome Manifest V3.
- Side panel: user interface and active guidance coordination while open.
- Content script: compact DOM observation, local element registry, overlay rendering, and user-action observation.
- Background service worker: Chrome API access, permissions, tab events, and screenshot capture. Never assume it stays alive; persist only minimal recoverable session state.
- Later milestone only: Cloudflare Workers + Hono backend, Gemini API, and Zod validation. No backend or AI integration until approved.
- Share small, explicit message types across extension components. Validate external/untrusted data at runtime.
- AI may propose an element ID, but the content script must recheck its existence, visibility, and current-page identity before highlighting.
Privacy and safety
- Request minimum browser permissions. Explain any additional permission before implementing it.
- Do not extract input values, passwords, tokens, cookies, payment information, or unnecessary private page content.
- Screenshots are optional and require explicit user consent before upload; do not implement them until their milestone.
- Treat webpage text and model output as untrusted data, never as commands to the extension.
- Keep API keys in backend secrets, never in extension source or client bundles.
- Do not log screenshots, secrets, or sensitive DOM content.
- Overlay decorations must not block normal webpage interactions.
Milestone workflow — mandatory human approval
1. Before editing, read docs/architecture.md, PLAN.md, and PROGRESS.md if present, plus this file.
2. Work on one approved milestone only. If no milestone is approved, propose the smallest next milestone and stop.
3. Before coding, briefly state the goal, files likely to change, approach, acceptance criteria, and tests.
4. Implement only the required scope. Ask before introducing significant dependencies or changing architecture.
5. Run the relevant typecheck, lint, tests, and build. Report exact commands and results; never claim tests passed if not run.
6. Give the user clear, numbered manual verification steps in Chrome, including expected results and how to observe failures.
7. Update PROGRESS.md with completed work, actual test evidence, remaining issues, and status AWAITING USER VERIFICATION.
8. STOP. Do not begin the next milestone until the user explicitly confirms verification and approves it.
9. If verification fails, fix the current milestone only, rerun checks, and request verification again.
10. Do not commit, push, deploy, publish, or modify production resources without explicit permission.
Testing expectations
- Test behavior, not implementation details. Use Vitest for pure functions and Playwright for browser workflows when introduced.
- DOM extraction: test visible/hidden elements, accessible names, duplicate labels, and safe omission of sensitive values.
- Overlays: test target alignment, scrolling, resizing, cleanup, and non-blocking interaction.
- Guidance: test missing targets, stale page state, invalid AI output, navigation, and recovery.
- Prefer small deterministic fixtures before testing live third-party sites.
- If a check cannot run, explain why and provide a manual alternative; do not conceal the limitation.
Communication and learning
- Explain important decisions in plain language, especially new browser APIs or TypeScript concepts.
- At the end of each milestone, summarize: what changed, why it was done this way, how it was tested, what the user must verify, and known limitations.
- Keep responses concise and actionable. Show relevant file paths, not large dumps of generated code.
- If two approaches work, prefer the one with fewer moving parts and easier debugging.
MVP order
1. Extension foundation and side panel.
2. Compact DOM extraction.
3. Highlight, arrow, and tooltip overlay.
4. Mocked end-to-end guidance without an AI API.
5. Backend and real Gemini-guided element selection.
6. Multi-step guidance with verification and recovery.
7. Optional consent-based screenshot fallback.
8. Security, testing, documentation, and release polish.
Definition of done: automated checks pass (or limitations are explicitly reported), manual verification instructions are supplied, PROGRESS.md is updated, and the user has approved the milestone. Until approval, the milestone remains pending.