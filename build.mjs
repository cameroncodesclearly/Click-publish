// Build step for the Click Publish web app.
//
// The design is authored as a Claude Design ".dc.html" prototype that the
// dc-runtime (support.js) interprets at runtime. This script bakes the whole
// thing into ONE self-contained index.html that runs on any static host
// (Vercel, Netlify, GitHub Pages, S3, …) with no build step and no relative
// asset fetches:
//
//   - React + ReactDOM (from node_modules) are inlined, so the runtime never
//     fetches them from a CDN.
//   - ios-frame.jsx is compiled with Babel and inlined, so the browser never
//     needs the ~2.8 MB Babel-standalone transform, and the component is a
//     plain window global (the <x-import> resolves it from global scope).
//   - support.js (the dc-runtime) is inlined.
//   - The avatar sprite PNG is inlined as a data: URI.
//
// The only remaining network requests are the app's imagery (Higgsfield /
// CloudFront PNGs, Giphy GIFs) and Google Fonts — all absolute public URLs
// that load in any real browser.
//
// Run with:  npm run build

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = new URL('.', import.meta.url).pathname;

function log(...a) { console.log('[build]', ...a); }

// Neutralize any literal </script> in inlined JS so it can't close the host
// <script> tag early.
const safeInline = (js) => js.replace(/<\/script>/gi, '<\\/script>');

// ── 1. read the raw parts ─────────────────────────────────────────────────
const react = readFileSync(root + 'node_modules/react/umd/react.production.min.js', 'utf8');
const reactDom = readFileSync(root + 'node_modules/react-dom/umd/react-dom.production.min.js', 'utf8');
const support = readFileSync(root + 'support.js', 'utf8');
const supabaseUmd = readFileSync(root + 'node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const cloud = readFileSync(root + 'cloud.js', 'utf8');

// Front-end config: prefer Vercel env vars, else config.js, else the example.
// (The anon key is a public client key; RLS is the security boundary.)
let configJs;
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  configJs = 'window.CP_CONFIG={url:' + JSON.stringify(process.env.SUPABASE_URL) +
    ',anonKey:' + JSON.stringify(process.env.SUPABASE_ANON_KEY) + '};';
  log('config from SUPABASE_URL / SUPABASE_ANON_KEY env vars');
} else if (existsSync(root + 'config.js')) {
  configJs = readFileSync(root + 'config.js', 'utf8');
  log('config from config.js');
} else {
  configJs = readFileSync(root + 'config.example.js', 'utf8');
  log('WARNING: no config.js — using config.example.js (local-only mode until you add Supabase keys)');
}

// Create the Supabase client (skipped for placeholder config → local-only mode).
// `window.sb ||` lets a test harness pre-inject a mock client before boot.
const sbInit =
  'try{window.sb=window.sb||((window.CP_CONFIG&&window.CP_CONFIG.url&&' +
  '!/YOUR[-_]/.test(window.CP_CONFIG.url))?supabase.createClient(window.CP_CONFIG.url,window.CP_CONFIG.anonKey):null);}' +
  'catch(e){console.error("[cloud] Supabase init failed",e);}';

// ── 2. compile ios-frame.jsx (React classic runtime -> global `React`) ─────
const Babel = require('@babel/standalone');
const iosJsx = readFileSync(root + 'ios-frame.jsx', 'utf8');
const iosJs = Babel.transform(iosJsx, { filename: 'ios-frame.jsx', presets: ['react'] }).code;
log('compiled ios-frame.jsx');

// ── 3. inline the avatar sprite as a data: URI ────────────────────────────
const spriteB64 = readFileSync(root + 'assets/avatars-sprite.png').toString('base64');
const spriteUri = 'data:image/png;base64,' + spriteB64;

// ── 4. assemble the self-contained index.html ────────────────────────────
let html = readFileSync(root + 'Click Publish.dc.html', 'utf8');

// Inline everything the runtime would otherwise fetch, in load order:
// React + ReactDOM must exist before support.js runs; ios-frame must set its
// window globals before the runtime boots (on DOMContentLoaded).
const inlined =
  '<title>Click Publish</title>\n' +
  // Truthy __resources tells the runtime NOT to re-fetch + re-parse this page
  // on boot. That self-parse would mis-read the inlined support.js source
  // (which contains <x-dc> patterns) and clobber the real template.
  '<script>window.__resources={};</script>\n' +
  // Cloud stack: config → Supabase client lib → client init → CloudStore.
  '<script>' + safeInline(configJs) + '</script>\n' +
  '<script>' + safeInline(supabaseUmd) + '</script>\n' +
  '<script>' + sbInit + '</script>\n' +
  '<script>' + safeInline(cloud) + '</script>\n' +
  '<script>' + safeInline(react) + '</script>\n' +
  '<script>' + safeInline(reactDom) + '</script>\n' +
  '<script>' + safeInline(iosJs) + '</script>\n' +
  '<script>' + safeInline(support) + '</script>\n';

if (!html.includes('<script src="./support.js"></script>')) {
  throw new Error('could not find support.js script tag to replace');
}
// NB: use function replacements so `$` sequences in the minified JS / data URI
// are inserted literally (a string replacement would interpret $&, $', $1…).
html = html.replace('<script src="./support.js"></script>', () => inlined);

// The <x-import> now resolves IOSDevice purely from global scope — drop the
// `from="./ios-frame.jsx"` module URL so nothing is fetched.
html = html.replace(' from="./ios-frame.jsx"', '');

// Inline the avatar sprite.
html = html.replaceAll('assets/avatars-sprite.png', () => spriteUri);

writeFileSync(root + 'index.html', html);
log('generated self-contained index.html (' + Math.round(html.length / 1024) + ' KB)');

// ── 5. mirror to dist/ for hosts configured with an output directory ──────
mkdirSync(root + 'dist', { recursive: true });
writeFileSync(root + 'dist/index.html', html);
log('mirrored to dist/index.html');
log('done.');
