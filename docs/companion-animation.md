# Animated ClickPilot companion

The user approved the original yellow/graphite character, idle direction, expressions and timing on 27 October 2026. The browser-extension integration is **AWAITING USER VERIFICATION**. This UI milestone does not change task ownership, consent, recovery, provider requests or autonomous-action rules.

## Build and edit

```sh
corepack pnpm install
corepack pnpm --filter @clickpilot/extension build
```

Reload the unpacked extension at `apps/extension/.output/chrome-mv3` in `chrome://extensions`. Graphics require no additional browser permission; the subsequently requested [interaction sounds](interaction-sounds.md) add the audio-only `offscreen` permission.

The approved editable Rive source and isolated playground remain in `prototypes/robot-playground`. After editing its RML:

```sh
npm --prefix prototypes/robot-playground run character
corepack pnpm --filter @clickpilot/extension build
```

The extension's `scripts/prepare-companion.mjs` copies the approved `public/robot.riv` and the installed matching Canvas WASM into ignored `public/buddy/` before build/typecheck. Generated copies are packaged by WXT. Do not hand-edit generated copies. When invoking WXT directly during development, run `node apps/extension/scripts/prepare-companion.mjs` first.

Rive React 4.37.1 and Canvas 2.45.1 must stay aligned. Motion is pinned to 14.6.0. All runtime files are bundled; CDN fallback is disabled. The character is 10,667 bytes, but the total unpacked extension is about 3.62 MB, including the 2.13 MB WASM runtime. The content script is about 516 KB. These are raw sizes, not network-compressed sizes.

## Responsibilities and surfaces

- Rive owns eyes, blinks, breathing, head movement and expression timelines. The approved `Buddy` state machine receives bounded data-binding properties, never page text or model output as animation commands.
- Motion owns float/click movement, native buddy spring positioning, bounded drag momentum, ask-card entrance/exit and the sidebar content entrance. Native controller logic remains in `buddy.ts`; a small React root owns only its artwork.
- The floating character renders inside the packaged `robot.html` extension page. A strict page CSP blocked even minimal WASM compilation in the isolated content-script context in the tested Chrome build, while asset fetches succeeded. The frame isolates graphics compilation under the extension CSP and reduces content-script size. It is decorative, hidden from accessibility, has no pointer events and is outside the form/task-control logic.
- A nonce-bound private `MessageChannel` connects each frame to its parent. The frame checks the source window/token once, then accepts only `DRAW_ROBOT` packets with expression 0–7, finite gaze in ±8/±7 and boolean still/active flags. No text, goals, page URLs, task commands or extension service messages pass through that channel. Extra fields are rejected.
- The sidebar uses Rive React directly. One active robot peeks over the header surface; small header/message avatars use the static approved-character poster. This avoids a WASM/canvas instance for every message.
- While the artwork loads or if an asset fails, the static poster remains visible and all existing ask controls still work. Hidden/offscreen graphics suspend. Back/forward cached frames pause and resume; unloaded frames clean up their runtime/channel.

The manifest enables local WASM with `script-src 'self' 'wasm-unsafe-eval'` for extension pages and exposes only the decorative `robot.html` page to HTTP/HTTPS sites. Graphics leave browser/host permissions unchanged; interaction audio separately adds `offscreen`. This does not weaken website CSP or load remote executable code. See Chrome's [extension CSP documentation](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy).

## Attention and task states

| Existing UI/task condition | Character |
| --- | --- |
| Idle | Approved breathing/blink/lean loop; eyes track the nearby cursor |
| Cursor approaches | Happy, with separate entry/exit distances to avoid repeated entrances |
| Click buddy | Surprise for 420 ms, then Happy for 1.3 seconds; typing or task changes interrupt it |
| Composer focused / composing | Listening/curious lean and gaze toward the writing area |
| Request, observation, verification or navigation | Thinking |
| Guidance waiting for the user | Listening; floating eyes look toward the highlighted element |
| Answer or confirmation | Happy |
| Clarification | Confused |
| Paused, stopped, recovery or disconnected | Sleepy; focused new-question composers can show Listening |
| Error or unsupported result | Brief concerned Error reaction, then calm pose |
| Reduced motion | Neutral Still, with no float, bounce, drag momentum or spring travel |

Attention reads only geometry and events from extension-owned composers. It does not read additional input values, selected text, page prose or the caret. Pending click timers are cancelled on focus/context/task changes and disposal. Pointer updates use refs, animation values and one batched frame-channel update rather than per-frame React state updates.

Click **Open sidebar** to dock the floating buddy toward the page's right edge and open the existing workspace. Dragging or clicking the docked buddy returns it to normal interaction. Chrome owns the actual side-panel width and closure; the extension animates its content and the page buddy, not Chrome's outer frame.

## Verification

```sh
corepack pnpm exec eslint apps/extension
corepack pnpm --filter @clickpilot/extension typecheck
corepack pnpm --filter @clickpilot/extension test
corepack pnpm --filter @clickpilot/extension build
corepack pnpm exec playwright test tests/e2e/buddy.spec.ts --workers=1
```

The buddy browser suite uses local fixtures and mocked responses. It covers existing task behavior plus strict-CSP graphics loading, proximity/click/typing, task expressions, live reduced motion, narrow sidebar layout, and an explicitly blocked character asset. Unit tests reject non-finite/out-of-range graphics values, extra content and task commands. Backend tests are excluded at the user's request.

Exact results, existing typecheck/overlay failures and manual Chrome steps are recorded in `PROGRESS.md`. A successful build or headless panel HTML test does not replace manual verification of Chrome's real sidebar, website interactions and motion preference behavior.
