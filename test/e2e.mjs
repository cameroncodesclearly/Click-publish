// End-to-end wiring test for the auth + cloud-sync layer, using an in-memory
// mock Supabase (test/mock-supabase.js) since this environment can't reach the
// real Supabase. Drives the built index.html in headless Chromium.
//
//   npm run build && npm run test:e2e
//
// Flow: boot → splash → sign up → onboarding (empty, no demo) → change an
// answer → clear the local cache → reload → data rehydrates FROM THE MOCK
// "server" → sign out → log back in → data returns.

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 5206;
const BASE = 'http://localhost:' + PORT;
const mockScript = readFileSync(join(HERE, 'mock-supabase.js'), 'utf8');

const fail = (m) => { console.error('❌ ' + m); throw new Error(m); };
const ok = (m) => console.log('✓ ' + m);

const server = spawn('node', [join(ROOT, 'server.mjs'), String(PORT)], { stdio: 'ignore' });
const errors = [];
let browser;
try {
  await new Promise((r) => setTimeout(r, 900));
  browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 560, height: 1000 } });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.addInitScript(mockScript);

  const text = () => page.evaluate(() => (document.getElementById('dc-root')?.textContent || ''));
  const waitFor = (sub, label) => page.waitForFunction(
    (s) => (document.getElementById('dc-root')?.textContent || '').includes(s), sub, { timeout: 12000 }
  ).catch(() => fail('timed out waiting for: ' + (label || sub)));
  const clickWith = (sub) => page.evaluate((s) => {
    // Pick the most specific (shortest-text) button that contains the label,
    // so we never click an ancestor container that merely wraps it.
    const matches = [...document.querySelectorAll('#dc-root button, #dc-root [role="button"]')]
      .filter((n) => (n.textContent || '').includes(s))
      .sort((a, b) => a.textContent.length - b.textContent.length);
    if (matches[0]) matches[0].click(); return !!matches[0];
  }, sub);

  // 1. boot resolves to the splash (mock has no session yet)
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await waitFor('CLICK', 'splash');
  const splash = await text();
  if (!splash.includes('PUBLISH') || !splash.includes('CREATIVE CREATORS')) fail('splash not rendered');
  ok('boot → splash');

  // 2. splash → auth (signup)
  await page.evaluate(() => document.querySelector('#dc-root [data-screen-label="Splash"]')?.click());
  await waitFor('STAGE NAME', 'signup form');
  ok('splash → create account');

  // 3. fill signup + submit
  await page.evaluate(() => {
    const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    const ins = document.querySelectorAll('#dc-root input');
    set(ins[0], 'Rae Delgado'); set(ins[1], 'rae@example.com'); set(ins[2], 'password123');
  });
  await clickWith("LET'S CREATE");
  await waitFor('MARQUEE', 'onboarding quiz step 1');
  const quiz1 = await text();
  if (/golden hour shoot|3 hooks that doubled/i.test(quiz1)) fail('demo data leaked into a fresh account');
  ok('sign up → onboarding quiz (fresh, no demo data)');

  // 4. answer step 1 → auto-advances to step 2 (niche); this writes to the cloud
  await clickWith('Personal brand');
  await waitFor('NICHE', 'quiz step 2');
  ok('answered step 1 → step 2');

  // 5. let the debounced cloud save flush, then wipe the LOCAL cache and reload
  await page.waitForTimeout(1900);
  await page.evaluate(() => localStorage.removeItem('clickpublish_v2'));
  await page.reload({ waitUntil: 'domcontentloaded' });

  // 6. must rehydrate from the mock "server" (local cache was cleared)
  await waitFor('NICHE', 'rehydrated quiz step 2 after reload');
  const afterReload = await text();
  if (afterReload.includes('STAGE NAME') || afterReload.includes('CREATIVE CREATORS')) fail('did not resume — fell back to splash/auth');
  ok('reload → rehydrated from cloud (local cache cleared)');

  // 7. sign out → back to splash ("TAP TO ROLL FILM" is splash-only)
  await page.evaluate(() => window.sb.auth.signOut());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitFor('TAP TO ROLL FILM', 'splash after sign out');
  ok('sign out → splash');

  // 8. log back in → data returns from cloud
  await page.evaluate(() => document.querySelector('#dc-root [data-screen-label="Splash"]')?.click());
  await waitFor('STAGE NAME', 'auth form');
  await clickWith('Already have an account'); // toggle to login
  await waitFor('WELCOME BACK', 'login mode');
  await page.evaluate(() => {
    const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    const ins = document.querySelectorAll('#dc-root input');
    set(ins[0], 'rae@example.com'); set(ins[1], 'password123');
  });
  await clickWith('LOG IN');
  await waitFor('NICHE', 'resumed quiz after login');
  ok('log in → data returned from cloud');

  const runtimeErr = await page.evaluate(() => [...document.querySelectorAll('.sc-logic-error, .sc-placeholder-error')].map((n) => n.textContent));
  if (runtimeErr.length) fail('runtime errors on page: ' + runtimeErr.join(' | '));
  const real = errors.filter((e) => !/Failed to load resource|net::ERR|ERR_|cloudfront|giphy|fonts\.g|favicon|status of 4|status of 5/i.test(e));
  if (real.length) fail('console/page errors: ' + real.join(' | '));
  ok('no runtime or console errors');

  console.log('\n✅ ALL E2E CHECKS PASSED');
} finally {
  if (browser) await browser.close();
  server.kill();
}
