# ClickPilot character workshop

**Character design, idle, expressions and timing approved on 27 October 2026.** The user approved the character design and idle direction on 27 October 2026. All eight expressions are now available in this standalone Rive/Motion playground. This playground remains isolated; production integration is documented separately below.

## Preview

From the repository root:

```sh
npm --prefix prototypes/robot-playground ci
npm --prefix prototypes/robot-playground run dev
```

Open **http://127.0.0.1:5176** in Chrome. The browser playground uses the checked-in, script-free `public/robot.riv`; its matching WASM runtime is bundled locally. No Rive account or CDN is needed.

For the **native Rive CLI preview**, including live reload of character edits:

```sh
~/.rive/bin/rive prototypes/robot-playground/character
```

Rive CLI 1.8.0 was installed in `~/.rive/bin/rive` using the official installer. No shell profile was changed. Read the generated [character/AGENTS.md](character/AGENTS.md) before editing RML. Native preview is the primary character preview. The separate browser playground is explicitly requested to evaluate Motion, and works because this asset contains **no unsigned scripts**. Do not add scripts without revisiting runtime compatibility and signing requirements.

## Design

An original, compact workshop robot: rounded yellow enamel head, two separate graphite eye housings, pale lenses, green-gray irises, a small ivory repair plate, and a tiny suspended body. Rounded housing, a single shell, short feet and a repair detail distinguish its silhouette from WALL-E. Curiosity comes from gaze, blink timing and a slight head lean.

The surrounding interface keeps ClickPilot green (`#315e47`), warm ivory (`#f6f3eb`) and quiet graphite. The robot brings yellow (`#f0c55f`) into the system. The playground includes light and dark surfaces.

## What is implemented

- **Rive:** the `Buddy` state machine with all eight expressions, mechanical blinks, head movement, breathing, smooth bounded gaze and a static `Still` state for reduced motion/pause. Every timeline owns the same pose properties so interruption resets previous eye scales and head tilts.
- **Motion:** floating, spring nudge on click, hover/press response, bounded drag with momentum, keyboard positioning, interruptible movement between contexts, and sample ask/sidebar enter/exit animations.
- **Attention:** a Rive interpolator smooths pointer gaze. Approaching brings happiness; moving away restores idle. Separate entry/exit distances prevent repeated reactions at the boundary. Clicking produces surprise for 420 ms, happiness for 1.3 seconds, then current attention. Composer focus selects Listening and redirects gaze toward the writing area; input events add a tiny acknowledgment. No text or caret value is read.
- **Preview controls:** Automatic reacts to attention. Other buttons hold a chosen expression for inspection. The toolbar reports actual Rive state-change events. Preview/context/focus changes and pause cancel pending click timers. Thinking, confused, sleepy and error are local previews, not a real AI result or task failure.
- **Accessibility/performance:** dynamic system reduced-motion handling plus a manual toggle, pause, visible focus, arrow-key movement/Home reset, and offscreen/hidden-page suspension. Pointer/drag frames use refs and motion values, not React state updates.

The sidebar view places its surface in front of the robot's lower body. This demonstrates the desired perch **inside the panel**. Chrome owns the real side-panel frame; future integration must use coordinated page/panel animations rather than moving a single DOM element across those separate browser surfaces.

## Approval sequence and expressions

| Expression / data value | Movement | Playback |
| --- | --- | --- |
| Idle / 0 | Breathing, head lean, irregular single/double blinks | Approved; 480-frame loop |
| Listening / 1 | Attentive lean, open eyes, writing-area gaze changes and blink | Approved; 240-frame loop |
| Thinking / 2 | Upward gaze, sideward searching, measured head movement | Approved; 240-frame loop |
| Happy / 3 | Anticipation, delighted rebound, lifted/squinted eyes | Approved; 72 frames, then hold |
| Confused / 4 | Asymmetric eyes and sideways head lean | Approved; 100 frames, then hold |
| Surprised / 5 | Wider eyes, smaller pupils and brief recoil | Approved; 54 frames, then hold |
| Sleepy / 6 | Heavy lids, long blink and slow droop; Motion floating stops | Approved; 360-frame loop |
| Error / 7 | Concerned recoil, then calm recovery; no flashing | Approved; 90 frames, then hold calm |

Each animation uses 60 fps. Select **Idle**, then the expression again to replay a held reaction. Listening stays attentive while the composer has focus and stops on blur; it does not infer when writing is finished. Reduced motion and Pause select Still, including when another preview is selected while paused. Resume to play the currently selected expression.

The character and expression timing are approved. Extension integration is now implemented and awaits Chrome verification; see [integration notes](../../docs/companion-animation.md). “Listening” means visual attention; no microphone/voice feature is planned.

## Modify and validate

The editable source is [character/scene.rml](character/scene.rml). Named nodes identify the apertures, expression-owned gaze, cursor-bound gaze, head pivot and body. Find the `LinearAnimation` named for the expression above. Edit its `KeyedObject` properties to adjust blink timing, gaze, breathing or tilt; rotations use radians. Preserve shared neutral properties in every timeline and the neutral `Still` pose. Animate the expression gaze parent, not the cursor-bound node.

Before adding or changing a Rive object/property, consult the installed schema:

```sh
~/.rive/bin/rive docs state-machines
~/.rive/bin/rive schema Node --all
~/.rive/bin/rive schema LinearAnimation --all
```

After every RML edit, compile, inspect and copy the binary to the playground:

```sh
npm --prefix prototypes/robot-playground run character
```

This runs `--verify`, reads `inspect --summary` and fails on reported problems, exports with `--once`, then updates `public/robot.riv`. Reload the browser to load the new binary. Override `RIVE_CLI` if the CLI is installed elsewhere. Do not hand-edit the binary.

Render reproducible native poses:

```sh
~/.rive/bin/rive prototypes/robot-playground/character --screenshot=/tmp/clickpilot-idle.png --advance=1
~/.rive/bin/rive prototypes/robot-playground/character --screenshot=/tmp/clickpilot-blink.png --advance=144
~/.rive/bin/rive prototypes/robot-playground/character --screenshot=/tmp/clickpilot-look.png --data=lookX=8 --data=lookY=-7 --advance=60
~/.rive/bin/rive prototypes/robot-playground/character --screenshot=/tmp/clickpilot-still.png --data=reduceMotion=true --advance=145
~/.rive/bin/rive prototypes/robot-playground/character --screenshot=/tmp/clickpilot-happy.png --data=expression=3 --advance=55
~/.rive/bin/rive prototypes/robot-playground/character --screenshot=/tmp/clickpilot-error.png --data=expression=7 --advance=26
```

Replace `--data=expression=3` with any value from the table. Different `--advance` frames show anticipation, peak and recovery. Error at frame 26 is concerned; after frame 100 it has recovered. To preview any moving expression natively, start `rive` with `--data=expression=N` and omit `--screenshot` and `--advance`.

The view model is `Buddy`: `lookX` ranges from −8 to 8, `lookY` from −7 to 7, `expression` uses 0–7 above, and `reduceMotion` selects Still before any expression condition. Any-state transitions allow interruption during the blend. Keep the mapping in [src/expressions.ts](src/expressions.ts) aligned with RML. Do not use deprecated state-machine inputs.

Movement lives in [src/main.tsx](src/main.tsx); character/runtime bindings live in [src/Robot.tsx](src/Robot.tsx). Adjust the shared spring or float amplitude in the playground without changing the Rive eye animation.

## Verification

```sh
npm --prefix prototypes/robot-playground run typecheck
corepack pnpm exec eslint --config prototypes/robot-playground/eslint.config.mjs prototypes/robot-playground/src prototypes/robot-playground/scripts
npm --prefix prototypes/robot-playground run build
npm --prefix prototypes/robot-playground run check:browser
```

The browser check needs the local dev server and the repository's existing Playwright/Chromium install. It exercises eight real state changes, proximity, click recovery, typing attention in both composers, timer interruption, dynamic reduced motion, pause, narrow layout and drag/Home. It blocks external requests. Captures default to the OS temporary directory under `clickpilot-expression-review`; set `CLICKPILOT_CAPTURE_DIR` to choose a directory.

The runtime versions are intentionally aligned: React Rive 4.37.1 requires Canvas 2.45.1. A newer direct canvas WASM is incompatible with that wrapper's runtime. Motion is pinned to 14.6.0. The character is now 10,667 bytes; the complete playground also includes React, Motion and the substantially larger Rive JS/WASM runtime. Production integration must measure that full cost and lazy-load it. A small `.riv` alone does not mean a small extension bundle.

Vite currently emits dependency `use client` directive warnings (this is a client-only playground) and a bundle-size warning. These are build warnings, not failures. Backend tests are outside this prototype's scope.

Manual Chrome review:

1. In **Automatic**, move the pointer around: pupils should follow inside the lenses. Approach for a happy lift; move away for idle. Hover at the boundary: happiness should not restart continuously. Console errors or external requests fail verification.
2. Click for surprise followed by happiness and the Motion nudge. Drag/release, use arrow keys/Home while focused, and reset during movement. Expect bounded movement and no card opening merely from a drag.
3. Select each expression and check its actual name in the toolbar. Select Idle then the expression again to replay short reactions. Error should settle calmly; Sleepy should stop the normal float.
4. Select Automatic and Floating buddy, click it, then focus/type in the composer. Expect Listening, a curious lean and gaze toward the writing area. Blur to restore automatic attention. No request should be sent.
5. Open workspace and type in its composer: expect the attentive robot above the panel edge. Switch to Thinking during a click reaction and wait two seconds: no stale timer should change it to Happy. Close/reopen and switch contexts rapidly: expect one robot and no stuck surface.
6. Toggle light/dark, narrow the browser and zoom. Expect readable controls, focus and contained composers. Enable reduced motion or change the system preference while open: every expression should settle to Still. Select a preview while paused, then resume: expect that selected expression. Test Pause/Resume and hidden/offscreen suspension separately.

## Official references consulted

- [Rive CLI](https://rive.app/cli), its [agent integration guide](https://rive.app/agents), generated `AGENTS.md`, and locally installed `rive docs` / `rive schema`.
- [Rive React runtime](https://rive.app/docs/runtimes/react/react) and [parameters](https://rive.app/docs/runtimes/react/parameters-and-return-values).
- [Motion for React](https://motion.dev/docs/react), [motion values](https://motion.dev/docs/react-motion-value), [springs](https://motion.dev/docs/react-use-spring), and [drag](https://motion.dev/docs/react-drag).
