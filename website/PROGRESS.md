# Klicko website progress

Updated: 3 November 2026.

Status: **VERIFIED by the user** for the downloadable ZIP on 3 November 2026. The website's Download Extension control serves a built Chrome extension archive from `public/downloads/klicko-chromium.zip`. The user confirmed it works and authorized committing and pushing to `website`. The original standalone website entry below is historical. No deployment or production resource change was authorized.

## ZIP download preparation — 2 November 2026

- The root `corepack pnpm package:extension` command rebuilds the extension with WXT and copies the generated Chrome ZIP into the website. The site config enables the download link; installation and FAQ copy describe the user-supplied provider key.
- `unzip -t` passed; `manifest.json` is at the ZIP root. The site-hosted and WXT archives had matching SHA-256 checksums. The exact extracted ZIP loaded as Klicko v0.1.0 in Chromium and opened its side panel.
- `npm run typecheck`, `npm run lint`, and `npm run build` passed. `npm run test:e2e` passed 5 Chrome tests, including the download. The first sandboxed browser run could not bind localhost; approved local execution passed.
- The user confirmed the package works correctly in their browser. Brave installation was not separately evidenced. A public website deployment still needs user approval, a reviewed privacy policy URL, and an absolute Open Graph image URL for the final domain.

The following website implementation record is historical.

## Completed

- Responsive single-page product site with sticky desktop/mobile navigation, hero using the approved robot SVG, launch film and poster, how-it-works, deterministic interactive preview, features, privacy and control, FAQ, manual install instructions, closing CTA, metadata, favicon, and footer.
- All main **Get Klicko** links lead to `#install`. The install section describes a release ZIP and five Chrome/Brave developer-mode steps. The Download Extension button is disabled while `releaseZipUrl` is unset; setting `chromeStoreUrl` later replaces its primary action.
- Privacy copy is limited to current extension behavior and notes that filtering is heuristic. No formal privacy policy has been represented as complete.
- The existing video and robot assets were copied into `website/public/assets/`. No source repository is offered as a download.
- Visual review covered desktop (1440 px), tablet (768 px), and mobile (390 px) viewport captures in `website/review/`. These local captures are ignored by Git. The first full-page capture exceeded Chrome's tall screenshot limit and repeated content near the bottom; section-sized viewport captures were used for the actual review.

## Checks run

| Exact command | Result |
| --- | --- |
| `npm run typecheck` | Exit 0. |
| `npm run lint` | Exit 0. |
| `npm run build` | Exit 0; Vite output in `dist/`. |
| `npm run test:e2e` | Exit 0: 5 Chrome browser checks passed, covering navigation and install state, keyboard FAQ and demo controls, demo progression, video play/pause, mobile menu/Escape/width, and desktop/tablet/mobile captures with no horizontal overflow. |

The first sandboxed browser run could not bind `127.0.0.1:4174` (`EPERM`). An approved local run started the fixture server. Early browser checks found two test issues: a text locator matched both an instruction and its illustration, and the video check paused before metadata loaded. The selectors and playback wait were corrected; the final run passed.

`npm install --offline --no-audit --no-fund` could not resolve uncached npm metadata. A networked install also did not complete in this restricted environment. For local checks, ignored `website/node_modules/` symlinks point to the repository's already installed versions of the exact pinned dependencies. A fresh standalone checkout should run `npm install` with registry access. No dependency or lockfile was added outside `website/`.

## Release blockers recorded on 29 October 2026 (historical)

The first two items were resolved by the later user-key and ZIP milestones recorded above; the remaining public deployment items still apply.

1. The extension's current manifest grants `http://127.0.0.1:8787/*`; guidance and text requests use the same local HTTP backend. A public ZIP needs a separately approved production HTTPS backend change, bundle/secret audit, and unpacked Chrome/Brave verification.
2. No verified release ZIP or Chrome Web Store listing URL is available. The Download Extension button remains disabled.
3. The page includes an accurate Privacy & control section. A reviewed formal privacy policy and URL are still required before public release.
4. The final website domain is needed to make the Open Graph image URL absolute.
5. The Glossa reference URL did not resolve from this environment. The supplied screenshot and written design direction informed the site; no Glossa code or assets were copied.

## Manual Chrome verification

1. From `website/`, run `npm install` (if dependencies are not installed) and `npm run dev`; open `http://127.0.0.1:4174` in Chrome. Expect the Klicko hero, real robot art, all page sections, and no console errors. A blank page or broken asset fails.
2. Click **Get Klicko** in the header and hero. Expect both to reach `#install`. The **Download Extension** button should be disabled with “Download pending production checks.” The five steps must mention the release ZIP, `chrome://extensions`, `brave://extensions`, Developer mode, Load unpacked, and `manifest.json`. A live or broken download URL fails.
3. Click **Watch demo**, then the film's play button. Expect the 25-second video to play with sound only after your action. Pause with the native controls and resume. A blank poster, autoplay sound, or media error fails.
4. In **Try Klicko right here**, start the example. Expect Settings highlighted. Click it yourself; expect Domains highlighted. Click Domains; expect the destination message. Use **Try again** to reset. An automatic dashboard click or a skipped step fails.
5. Resize Chrome to desktop, tablet, and phone widths. On a narrow width, open the menu, use a section link, and confirm the menu closes. Check for clipped text, sideways scrolling, or inaccessible buttons. Expand FAQ entries with keyboard Enter/Space and inspect the Privacy & control section.

The milestone remains pending until the user confirms visual and manual verification. Do not start a public release or the next extension milestone without separate approval.
