# Milestone 3 overlay fixture matrix

Recorded: 21 October 2026. Scope: production MV3 build in Playwright Chromium, synthetic `tests/fixtures/overlay.html`. Test source: `tests/e2e/overlay.spec.ts`. Each row corresponds to one numbered browser test. This is automated fixture evidence. The user subsequently verified the actual Chrome behavior: correct target, aligned geometry, click-through, invalid-target clearing, and cleanup. Brave verification remains unconfirmed.

Command: `corepack pnpm exec playwright test` after `corepack pnpm build`. Result: exit 0, 22 tests passed (20 overlay cases below plus two existing inspection tests).

| Case | Interaction | Expected and observed result | Result |
|---|---|---|---|
| 01 | Select Primary target | Live outline matches target within 1 CSS px; SVG arrow and literal tooltip exist; click count and scroll remain zero; panel fits 260 px width | PASS |
| 02 | Select navigation Settings | Exact navigation element is outlined despite duplicate label | PASS |
| 03 | Select dialog Settings | Exact Preferences element is outlined | PASS |
| 04 | Click target; select input and type fake marker | Counter increments once; input accepts text; tooltip omits typed value; all decoration nodes have pointer-events none | PASS |
| 05 | Scroll window, then leave viewport | Outline follows scroll, then clears with honest panel status | PASS |
| 06 | Scroll nested container, then clip target | Outline follows nested scrolling, then clears | PASS |
| 07 | Resize page from 1100 to 700 CSS px | Outline stays aligned | PASS |
| 08 | Set actual browser tab zoom to 125% | Zoom API confirms applied value; outline stays aligned | PASS |
| 09 | Click Move target | Outline follows CSS translation | PASS |
| 10 | Click Cover target | Covered target's decoration clears; panel reports removal | PASS |
| 11 | Click Hide target | Hidden target's decoration clears; panel reports removal | PASS |
| 12 | Click Remove target | Detached target's decoration clears; panel reports removal | PASS |
| 13 | Disable target after snapshot, then select it | Selection is refused; no overlay; panel reports unavailable | PASS |
| 14 | Submit old snapshot/document IDs or nonexistent element ID | All three commands return explicit failure; no decoration | PASS |
| 15 | Submit tooltip containing img/onerror and script markup | Exact string appears as text; no img/script nodes; page remains intact | PASS |
| 16 | Press Stop, then move target and scroll | Overlay and list disappear; layout changes do not resurrect decoration | PASS |
| 17 | Inspect/highlight repeatedly | Previous decoration clears; exactly one overlay after selection | PASS |
| 18 | SPA navigation, reinspection, full reload, reinspection, panel close | Navigation clears old UI; new document can highlight; closing panel clears new decoration too | PASS |
| 19 | Switch to another tab | Old overlay clears; panel reports tab change | PASS |
| 20 | Close panel; reopen and replay its last valid target | Overlay clears on disconnection; registry is discarded and replay fails | PASS |

No tests failed in the completed matrix. The first sandboxed browser invocation could not start the localhost server (PermissionError on port 4173), so the successful matrix ran with local browser/server access outside that sandbox. Typecheck, lint, and unit evidence is recorded in `PROGRESS.md`.

Visual evidence was captured locally at `/tmp/clickpilot-overlay-desktop.png`, `/tmp/clickpilot-panel-360.png`, and `/tmp/clickpilot-panel-260.png`. These synthetic local test captures are not an extension screenshot feature or an upload path.

Limits: headless panel HTML substitutes for real side-panel placement; Chromium is not a manual Chrome/Brave verification. Tests cover 125% zoom and one resize, not every display scale or site. One-minute expiry exists but is not timed by this matrix. Five-point hit testing can miss partial occlusion between sampled points. Iframe/shadow-tree/canvas targeting, browser top-layer UI, and unusual page transforms are outside the verified matrix. Animation-frame tracking is active only while a highlight exists; Stop removes its animation callback and lifecycle listeners, while the idempotent content-message listener stays available for the next inspection.
