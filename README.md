# Click Publish

A social-media **accountability app for creators**, by Clear Sky Creations. It walks
a creator from sign-up through a cinematic onboarding "screen test" (niche, cadence,
follower/impression targets, baseline) into a daily workflow: a call-sheet of daily
tasks, a scoreboard tracking followers and impressions against goals, challenges,
an idea/inspiration board, analytics check-ins, best-performer tracking, and a
community feed — all wrapped in a vintage-film / "roll the picture" theme.

This repository is the runnable implementation of the **`Click Publish.dc.html`**
design authored in [Claude Design](https://claude.ai/design). It's a single-screen
mobile web app with no backend — all state persists to the browser's `localStorage`
(key `clickpublish_v2`).

## The deployable is a single self-contained file

**`index.html` is the whole app in one file.** React, the dc-runtime, the iOS
device-frame component, and the avatar sprite are all inlined, so the page has **no
relative dependencies and needs no build step to serve**. Drop it on any static host
(Vercel, Netlify, GitHub Pages, S3, a plain file server) and it runs — at the domain
root or any sub-path. The only network requests it makes are for imagery (Higgsfield /
CloudFront PNGs, Giphy GIFs) and Google Fonts, which are absolute public URLs.

### Deploying to Vercel

The included `vercel.json` tells Vercel to skip install/build and serve the repo root
as static files, so `index.html` is served directly. Just point Vercel at the repo
(or the branch) — no framework preset, no configuration needed.

## Local development

```bash
npm install      # dev-only tooling (React/ReactDOM, Babel, a headless-test browser)
npm run build    # regenerate index.html from the design
npm start        # serve at http://localhost:5173
```

## How it works

The design is authored in Claude Design's **`.dc.html`** format and interpreted by the
**dc-runtime** (`support.js`) — a small React-based engine that renders the `<x-dc>`
template (with `{{ }}` bindings, `sc-if`, `sc-for`, and `x-import`) against the state
machine defined in the file's `<script data-dc-script>` block.

`build.mjs` bakes all of that into the single `index.html`:

| Source file | Role |
| --- | --- |
| `Click Publish.dc.html` | The original design export — the source of truth (template + full app logic). |
| `support.js` | The dc-runtime that parses and renders the design. |
| `ios-frame.jsx` | The iOS device-frame component (`IOSDevice`, status bar, keyboard). |
| `build.mjs` | Inlines React + ReactDOM, compiles `ios-frame.jsx` with Babel, inlines the runtime and the avatar sprite, and writes the self-contained `index.html` (+ a `dist/` mirror). |
| `server.mjs` | Zero-dependency static server for local development. |
| `index.html` | **Build output** — the self-contained, deployable app. |

## Editing the design

Change the design in Claude Design and re-export `Click Publish.dc.html` (or edit the
`<script data-dc-script>` logic / `<x-dc>` template directly), then run `npm run build`
to regenerate `index.html`.
