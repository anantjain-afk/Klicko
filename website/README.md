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

From the repository root, refresh the site-hosted ZIP after each extension change:

```sh
corepack pnpm package:extension
```

This runs WXT's Chrome ZIP build and copies its output to `public/downloads/klicko-chromium.zip`. The archive contains built extension files with `manifest.json` at its root. The website serves it at `/downloads/klicko-chromium.zip`. Rebuild the website after refreshing the ZIP so `dist/` contains the matching archive. The command does not deploy or publish anything.

Edit [`src/site-config.ts`](src/site-config.ts) for other release links:

- `releaseZipUrl` currently points to the site-hosted ZIP. The primary **Download Extension** control downloads that archive.
- `chromeStoreUrl`: when the extension is published, set this URL. The primary install action will prefer the store URL automatically. The site's **Get Klicko** links continue to lead to the install section.
- `privacyPolicyUrl`: link to the reviewed, published formal policy. The page's **Privacy & control** section is a product explanation, not a complete legal policy.

The current extension sends AI requests directly to the provider selected in Settings. Each user adds their own Gemini, OpenAI, or Groq key; no backend service or key is bundled. Provider usage may be charged to that user's account. The ZIP is a manual, developer-mode install: download, extract, open `chrome://extensions` or `brave://extensions`, enable Developer mode, choose **Load unpacked**, and select the extracted folder containing `manifest.json`. Keep that folder in place while using the extension. Installing a later ZIP from a different folder may create a different extension identity and will not carry over locally saved keys.

Before public deployment, verify the exact extracted archive in Chrome and Brave, review the formal privacy policy, and set its URL. Website deployment, repository push, and store publication require separate approval.

The actual mascot SVG was copied from `brag-output/composition/assets/robot.svg`. The 25-second launch film and poster were copied from `brag-output/brag.mp4` and `brag-output/brag.jpg`. The film is labelled illustrative because its UI scenes are recreated for the launch video. The website's guided dashboard is a local scripted simulation.

## Deploy on Vercel

Create a Vercel project using this repository, set **Root Directory** to `website`, **Framework Preset** to Vite, **Build Command** to `npm run build`, and **Output Directory** to `dist`. Vercel can install the pinned dependencies from `package.json`. No website environment variables or backend are needed for this static site.

Before public deployment, add the formal privacy policy and replace the relative `og:image` in `index.html` with an absolute URL using the final domain. The website build itself does not deploy or publish anything.
