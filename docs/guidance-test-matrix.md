# Milestone 4 guidance fixture results

Recorded: 21 October 2026. Production MV3 build in Playwright Chromium using `tests/fixtures/guidance.html`; test source is `tests/e2e/guidance.spec.ts`. Manual Chrome verification remains pending.

Final command: `corepack pnpm exec playwright test` after `corepack pnpm build` — exit 0, 34 passed in 43.9 seconds: 12 guidance workflows below, the existing 20-case overlay matrix, and two inspection checks. Final unit command `corepack pnpm test` passed 21 tests in three files. Typecheck, lint, and build passed; detailed failures and fixes are in `PROGRESS.md`.

| Workflow | Expected and observed behavior | Result |
|---|---|---|
| Question → highlight → user click | Real snapshot selects primary target; counter stays zero until user action; click on child text is acknowledged without completion claim; no nonlocal request observed; panel fits 360/260 px | PASS |
| Ambiguity and unsupported requests | Settings asks for clarification, unknown task is refused, navigation Settings selects exact intended element | PASS |
| Unsupported page | Overlay fixture has the matching label but mock refuses because URL is not the guidance fixture | PASS |
| Missing target | Removed primary target yields a missing-control message, no overlay | PASS |
| Stop and Retry | Stop aborts two-second selection, no late highlight; Retry starts fresh and waits for user without clicking | PASS |
| Replacement | New normal Profile task supersedes delayed primary task; old delay never replaces the new highlight | PASS |
| Invalid target/output scenarios | Stale-once recovers; stale-always pauses after one refresh; malformed output yields error, no decoration | PASS |
| Target removed during selection | Live highlight is refused; fresh observation reports missing target without drawing a stale element | PASS |
| SPA navigation during selection | Route change cancels delayed selection; no late highlight | PASS |
| Tab switching and full navigation | Active guidance cancels, page-change status is honest, old decoration disappears | PASS |
| Synthetic/unrelated clicks | Scripted `.click()` and clicks on other controls do not acknowledge; a real target click does | PASS |
| Covered target, mode change, panel close | Coverage pauses/removes guidance; mode switch cancels; closing panel during delayed selection prevents late decoration | PASS |

Additional unit evidence: fresh session/request identity rejects obsolete click events; cleanup of a late inspection is scoped to its old snapshot; Stop during an outstanding highlight reply cannot return the controller to waiting. Unit tests assert exactly two observations at most for one invalid-target recovery.

The initial browser run had two failures (32/34 passed): navigation diagnostic ordering and panel-close cleanup after content reinjection. A focused rerun still reproduced the close failure. The final full run passed both after fixes. The sandboxed server start was denied; successful browser checks ran with local server/browser access outside that sandbox. A diagnostic attempt to start another fixture server found port 4173 already in use; the existing fixture server was reused.

Limits: panel HTML in a tab substitutes for actual side-panel placement. This is deterministic mock behavior, not model accuracy or verified workflow completion. Requests are a documented finite vocabulary on the exact localhost fixture, not general language understanding. Coverage is synthetic Chromium behavior and the shipped viewport samples, not every Chrome/Brave version or display scale. One-minute expiry remains outside this timed matrix. Existing DOM/overlay exclusions still apply.

Inspected local synthetic captures: `/tmp/clickpilot-m4-waiting-360.png`, `/tmp/clickpilot-m4-waiting-260.png`, `/tmp/clickpilot-m4-page.png`. These test captures do not add a screenshot capture/upload feature to the extension.
