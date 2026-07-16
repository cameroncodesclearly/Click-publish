// Click Publish — front-end config.
//
// Copy this file to `config.js` and fill in your Supabase project's values
// (Dashboard → Project Settings → API). Both values are SAFE to expose in the
// browser — the anon key is a public client key and Row Level Security is the
// real security boundary. NEVER put the `service_role` key here.
//
// `config.js` is git-ignored. On Vercel you can instead set the environment
// variables SUPABASE_URL and SUPABASE_ANON_KEY and let `build.mjs` generate
// config.js at build time.
//
// If these stay as placeholders, the app runs in local-only mode (data stays
// on the device, no real accounts) so you can still preview it.

window.CP_CONFIG = {
  url: 'https://YOUR-PROJECT.supabase.co',
  anonKey: 'YOUR_SUPABASE_ANON_KEY',
};
