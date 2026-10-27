# ClickPilot interaction sounds

The user's WAV files are bundled locally from the root `sounds/` folder. Only the nine requested clips are copied by `apps/extension/scripts/prepare-companion.mjs` during build/typecheck.

| Interaction | Clip |
| --- | --- |
| First buddy show, or show after Hide | `agent-launch.wav` |
| Hide ClickPilot or close Chrome's sidebar | `agent-close.wav` |
| Open ask card by clicking the bot | `clicky-text-open.wav` |
| Close ask card by clicking the bot, its close button, or Escape | `clicky-text-close.wav` |
| Send a normal question from buddy/sidebar | `clicky-text-send.wav` |
| Submit a question about selected text | `clicky-text-selection.wav` |
| Open sidebar | `sidebar.wav` |
| New normal assistant reply | `boing-1.wav` |
| New selected-text reply | `boing-2.wav` |

`src/lib/sounds.ts` provides one typed `playSound()` helper. The service worker validates a finite cue name and lazily opens the packaged `audio.html` document using Chrome's **offscreen** permission and `AUDIO_PLAYBACK` reason. That audio-only page plays the local WAV at **50% volume**, replacing any previous clip to prevent overlap. Chrome retires an idle audio document after 30 seconds; the next cue recreates it. This uses no microphone, external library, remote media or additional website access.

The separate audio document is necessary because Chrome blocked the initial launch clip in the webpage's character frame before any page interaction. It also lets a close cue finish after a UI document closes. The decorative Rive frame and its numeric graphics channel remain separate from audio.

One observer in the shared conversation owner detects newly appended assistant message IDs. It chooses the boing from the message's normal/selected-text source, so showing the same reply in both surfaces or reopening history does not play it twice. Restored initial history is ignored. No message text is sent to the audio player.

The launch cue is once per buddy activation, not once per ask-card opening or once for the lifetime of the installation. The sidebar cue uses Chrome’s `sidePanel.onOpened` event (Chrome 141+), with document-open fallback on older versions. The built-in sidebar close cue uses `sidePanel.onClosed` (Chrome 142+). Closing the entire browser is not a playback surface.

Build and reload:

```sh
corepack pnpm --filter @clickpilot/extension build
```

Reload the unpacked extension from `apps/extension/.output/chrome-mv3` at `chrome://extensions`. The new `offscreen` permission supports local audio playback. Unit tests were intentionally skipped at the user's request. Check exact build/lint/typecheck and browser playback evidence in `PROGRESS.md`; listen manually to verify loudness and timing.
