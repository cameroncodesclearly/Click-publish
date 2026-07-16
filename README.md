# Click Publish

A social-media **accountability app for creators**, by Clear Sky Creations. It walks
a creator from sign-up through a cinematic onboarding "screen test" (niche, cadence,
follower/impression targets, baseline) into a daily workflow: a call-sheet of daily
tasks, a scoreboard tracking followers and impressions against goals, challenges,
an idea/inspiration board, analytics check-ins, best-performer tracking, and a
community feed — all wrapped in a vintage-film / "roll the picture" theme.

Originally authored as a [Claude Design](https://claude.ai/design) prototype
(`Click Publish.dc.html`), it's now a **real multi-user web app**: people sign up, log
in on any device, and their data is stored in the cloud. It stays a **static site**
(the Supabase SDK runs in the browser; Row Level Security protects each account's
data), so there's no server to run — deploy it to Vercel, Netlify, GitHub Pages, etc.

Metrics (followers, impressions, post analytics) are entered manually for now;
automatic platform sync is a future addition.

---

## Set up the backend (Supabase) — one time

The app needs a Supabase project for accounts + data. It's free and takes a few minutes.

1. Create a project at <https://supabase.com> (New project).
2. **Database schema:** open the project's **SQL Editor**, paste the contents of
   [`supabase/schema.sql`](./supabase/schema.sql), and **Run**. This creates the
   `app_states` + `profiles` tables and the Row Level Security policies that keep each
   account's data private.
3. **Auth:** Dashboard → **Authentication → Providers → Email** is on by default. For
   the fastest start, turn **off** "Confirm email" (Authentication → Providers → Email)
   so people can sign up and use the app immediately. Leave it on if you want verified
   emails (users then must click a confirmation link before logging in).
4. **Get your keys:** Dashboard → **Project Settings → API** → copy the **Project URL**
   and the **anon public** key. (Both are safe in the browser — never use the
   `service_role` key here.)

## Configure the app with your keys

Either commit-free via env vars (recommended for Vercel) **or** a local file:

- **Local file:** copy `config.example.js` to `config.js` and paste your Project URL +
  anon key. `config.js` is git-ignored. Then `npm run build`.
- **Vercel env vars:** in the Vercel project settings add `SUPABASE_URL` and
  `SUPABASE_ANON_KEY`. `build.mjs` reads them at build time and bakes them in.

> Until real keys are provided the app runs in **local-only mode** (data stays on the
> device, no real accounts) so you can still preview it.

## Deploy to Vercel

1. Import the repo in Vercel.
2. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` env vars (or commit a filled-in
   `config.js`). The included `vercel.json` builds with `npm run build` and serves the
   generated static site.
3. In Supabase → Authentication → **URL Configuration**, set your Vercel URL as the
   **Site URL** (and add it to Redirect URLs) so email confirmation / password reset
   links come back to your app.

## Local development

```bash
npm install      # tooling: React/ReactDOM, Babel, Supabase client, a headless-test browser
npm run build    # bake everything into a self-contained index.html
npm start        # serve at http://localhost:5173
npm run test:e2e # headless auth + cloud-sync flow test (uses an in-memory mock backend)
```

---

## How it works

The design is authored in Claude Design's **`.dc.html`** format and interpreted by the
**dc-runtime** (`support.js`) — a small React-based engine that renders the `<x-dc>`
template against the state machine in the file's `<script data-dc-script>` block.
`build.mjs` bakes it all into one self-contained `index.html`.

**Persistence** funnels through the logic class's `load()`/`save()`:
- `save()` writes to `localStorage` immediately (offline cache) and debounces a cloud
  upsert of the whole app-state blob to the signed-in user's `app_states` row.
- On boot, `componentDidMount()` checks the Supabase session and hydrates from the
  cloud (cloud wins over the local cache); a brief loading gate blocks edits until then.
- All Supabase calls live in `cloud.js` (`window.CloudStore`), so the app logic stays
  small and tests can stub the client.

| File | Role |
| --- | --- |
| `Click Publish.dc.html` | The app: `<x-dc>` UI template + the `DCLogic` state machine (auth, onboarding, tabs, cloud sync). |
| `support.js` | The dc-runtime that renders the design. |
| `ios-frame.jsx` | The iOS device-frame component. |
| `cloud.js` | `window.CloudStore` — thin wrapper over the Supabase client. |
| `supabase/schema.sql` | Tables + Row Level Security to run in your Supabase project. |
| `config.example.js` | Template for `config.js` (your Supabase URL + anon key). |
| `build.mjs` | Inlines React, the Supabase client, config, `cloud.js`, the runtime, and the avatar sprite into `index.html`. |
| `server.mjs` | Zero-dependency static server for local dev. |
| `test/` | Mock Supabase client + headless e2e flow test. |
| `index.html` | **Build output** — the self-contained, deployable app. |

## Data model

Each account has one row in `app_states` (`user_id`, `data jsonb`, `updated_at`) holding
the whole app state, plus a `profiles` row (`display_name`, `role`). Row Level Security
means a user can only read/write their own rows. A future coach dashboard (view clients'
progress) can be layered on via the `profiles.role`/`coach_id` fields without reworking
the app.

## Not in this version

Automatic metric sync from Instagram/TikTok/YouTube; a coach dashboard over clients; a
real community bulletins/leaderboard backend (those are static preview content for now);
account deletion beyond sign-out; cross-device conflict resolution beyond last-write-wins.
