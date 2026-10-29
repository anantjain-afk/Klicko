# Klicko website

Standalone React, TypeScript, and Vite landing page. All website files and copied assets live in this folder. The site does not call the extension backend or any AI service.

## Run locally

```sh
cd website
npm install
npm run dev
```

Open `http://127.0.0.1:4174`.

Checks:

```sh
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

The browser checks use installed Google Chrome. `npm run preview` serves the production build locally.

## Release links

Edit [`src/site-config.ts`](src/site-config.ts):

- `releaseZipUrl`: point to a verified ZIP of the **built Chromium extension**, not the source repository. Put a site-hosted ZIP at `public/downloads/klicko-chromium.zip` and use `/downloads/klicko-chromium.zip`, or use an approved HTTPS release URL. The ZIP's extracted folder must contain `manifest.json` at its top level.
- `chromeStoreUrl`: when the extension is published, set this URL. The primary install action will prefer the store URL automatically. The site's **Get Klicko** links continue to lead to the install section.
- `privacyPolicyUrl`: link to the reviewed, published formal policy. The page's **Privacy & control** section is a product explanation, not a complete legal policy.

The Download Extension button is disabled until a verified release URL is configured. It does not point to a source checkout or a placeholder URL.

Before making a ZIP public, change the extension to a production HTTPS backend in a separately approved extension task. Verify its manifest and built files contain no secrets, localhost API endpoint, or development-only host permissions, then test that exact package as an unpacked extension in Chrome and Brave. The current extension still uses `http://127.0.0.1:8787`; **do not publish that build**.

The actual mascot SVG was copied from `brag-output/composition/assets/robot.svg`. The 25-second launch film and poster were copied from `brag-output/brag.mp4` and `brag-output/brag.jpg`. The film is labelled illustrative because its UI scenes are recreated for the launch video. The website's guided dashboard is a local scripted simulation.

## Deploy on Vercel

Create a Vercel project using this repository, set **Root Directory** to `website`, **Framework Preset** to Vite, **Build Command** to `npm run build`, and **Output Directory** to `dist`. Vercel can install the pinned dependencies from `package.json`. No website environment variables or backend are needed for this static site.

Before public deployment, add the verified release link and formal privacy policy, and replace the relative `og:image` in `index.html` with an absolute URL using the final domain. The website build itself does not deploy or publish anything.
