// Build step for the Click Publish web app.
//
// The design is authored as a Claude Design ".dc.html" prototype that the
// dc-runtime (support.js) interprets at runtime. This script turns that
// prototype into a self-contained, offline-capable static site:
//
//   1. Vendors React + ReactDOM UMD builds from node_modules into vendor/.
//   2. Pre-compiles ios-frame.jsx -> ios-frame.js so the browser never needs
//      the ~2.8 MB Babel-standalone transform at runtime.
//   3. Generates index.html from "Click Publish.dc.html":
//        - points the dc-runtime's React/ReactDOM CDN URLs at the local
//          vendored copies (window.__resources), so no unpkg fetch happens;
//        - rewrites the ios-frame import from .jsx to the compiled .js;
//        - adds a <title>.
//
// Run with:  npm run build
//
// Note: the app's imagery (Higgsfield/CloudFront PNGs + Giphy GIFs) and Google
// Fonts are loaded from their public CDNs at runtime — those render in any
// real browser; only this sandbox's egress policy blocks them.

import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = new URL('.', import.meta.url).pathname;

const REACT_URL = 'https://unpkg.com/react@18.3.1/umd/react.production.min.js';
const REACT_DOM_URL = 'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js';

function log(...a) { console.log('[build]', ...a); }

// ── 1. vendor React + ReactDOM ────────────────────────────────────────────
mkdirSync(root + 'vendor', { recursive: true });
copyFileSync(root + 'node_modules/react/umd/react.production.min.js', root + 'vendor/react.production.min.js');
copyFileSync(root + 'node_modules/react-dom/umd/react-dom.production.min.js', root + 'vendor/react-dom.production.min.js');
log('vendored react + react-dom');

// ── 2. compile ios-frame.jsx -> ios-frame.js ──────────────────────────────
const Babel = require('@babel/standalone');
const jsx = readFileSync(root + 'ios-frame.jsx', 'utf8');
const { code } = Babel.transform(jsx, {
  filename: 'ios-frame.jsx',
  presets: ['react'],
});
const banner = '// GENERATED from ios-frame.jsx by build.mjs — do not edit. Run `npm run build`.\n';
writeFileSync(root + 'ios-frame.js', banner + code);
log('compiled ios-frame.jsx -> ios-frame.js');

// ── 3. generate index.html from the .dc.html prototype ────────────────────
let html = readFileSync(root + 'Click Publish.dc.html', 'utf8');

const resources = {
  [REACT_URL]: './vendor/react.production.min.js',
  [REACT_DOM_URL]: './vendor/react-dom.production.min.js',
};
const inject =
  '<title>Click Publish</title>\n' +
  '<script>window.__resources=' + JSON.stringify(resources) + ';</script>\n';

// Insert our resource map + title immediately before the support.js runtime so
// __resources exists when the runtime's IIFE loads React.
if (!html.includes('src="./support.js"')) {
  throw new Error('could not find support.js script tag to anchor injection');
}
html = html.replace('<script src="./support.js"></script>',
  inject + '<script src="./support.js"></script>');

// Use the pre-compiled component so no runtime Babel is needed.
html = html.replaceAll('./ios-frame.jsx', './ios-frame.js');

writeFileSync(root + 'index.html', html);
log('generated index.html');

// ── 4. assemble a deployable dist/ (static host drop-in) ──────────────────
import { cpSync, rmSync } from 'node:fs';
const dist = root + 'dist/';
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
writeFileSync(dist + 'index.html', html);
for (const f of ['support.js', 'ios-frame.js']) copyFileSync(root + f, dist + f);
cpSync(root + 'vendor', dist + 'vendor', { recursive: true });
if (existsSync(root + 'assets')) cpSync(root + 'assets', dist + 'assets', { recursive: true });
log('assembled dist/');
log('done.');
