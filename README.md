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

## Quick start

```bash
npm install      # dev-only tooling (React/ReactDOM UMD, Babel, a headless-test browser)
npm run build    # compile ios-frame.jsx, vendor React, generate index.html + dist/
npm start        # serve at http://localhost:5173
```

Then open <http://localhost:5173>. It must be served over HTTP (not opened as a
`file://` URL) because the runtime fetches `support.js` and `ios-frame.js` at load
time.

## How it works

The design is authored in Claude Design's **`.dc.html`** format and interpreted by
the **dc-runtime** (`support.js`) — a small React-based engine that renders the
`<x-dc>` template (with `{{ }}` bindings, `sc-if`, `sc-for`, and `x-import`) against
the state machine defined in the file's `<script data-dc-script>` block.

| File | Role |
| --- | --- |
| `Click Publish.dc.html` | The original design export — the source of truth (template + full app logic). |
| `index.html` | The runnable entry, **generated** from the `.dc.html` by `build.mjs`. |
| `support.js` | The dc-runtime that parses and renders the design. |
| `ios-frame.jsx` | The iOS device-frame component (`IOSDevice`, status bar, keyboard). |
| `ios-frame.js` | Build output — `ios-frame.jsx` pre-compiled so no in-browser Babel is needed. |
| `vendor/` | React + ReactDOM UMD builds, served locally instead of from a CDN. |
| `assets/avatars-sprite.png` | The avatar sprite sheet used in the profile screen. |
| `build.mjs` | Compiles the JSX, vendors React, and generates `index.html` + `dist/`. |
| `server.mjs` | Zero-dependency static file server for local development. |

`build.mjs` makes the app self-contained by pointing the runtime's React/ReactDOM
CDN URLs at the local `vendor/` copies and using the pre-compiled component, so the
only remaining runtime network calls are for the app's **imagery** (Higgsfield /
CloudFront PNGs, Giphy celebration GIFs) and **Google Fonts** (Anton, Yellowtail,
Archivo). Those load in any real browser.

## Editing the design

Change the design in Claude Design and re-export `Click Publish.dc.html` (or edit the
`<script data-dc-script>` logic / `<x-dc>` template directly), then run `npm run build`
to regenerate `index.html`.

## Deploying

`npm run build` writes a static, drop-in `dist/` folder (git-ignored) containing
`index.html`, `support.js`, `ios-frame.js`, `vendor/`, and `assets/`. Upload it to any
static host (GitHub Pages, Netlify, Vercel, S3, …).
