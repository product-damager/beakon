# Deploying Beakon to Netlify

This guide takes Beakon from your repo to a live, authenticated URL on Netlify's
**free** plan — with no commercial-use restriction (unlike Vercel's Hobby tier).

---

## 1. How the deployment is shaped

Beakon has **two independent moving parts**. Netlify only hosts the first one.

| Part | What it is | Where it lives | Cost |
|------|-----------|----------------|------|
| **Frontend** | The Next.js 16 app (this repo) | **Netlify** | Free |
| **Backend** | Postgres, auth, magic links | **Supabase** (already SaaS-hosted) | Free |

The app talks to Supabase **directly from the browser** using a browser-safe
*publishable* key. There is **no custom server, no API routes, and no secrets** in
the deployment — everything Netlify serves is public frontend code. That's what
makes this deploy simple: Netlify just builds and serves Next.js; Supabase does
the rest.

> **Important:** Beakon runs on in-memory seed data when no Supabase env vars are
> present (see `lib/supabase.ts` → `isSupabaseConfigured`). So if you deploy
> *without* setting the env vars, you'll get a working **demo with no login and no
> persistence**. To get real auth + saved data, you must complete Section 3.

---

## 2. Prerequisites

- The Beakon repo pushed to **GitHub/GitLab/Bitbucket** (Netlify deploys from Git).
- A free **Netlify** account → https://app.netlify.com (sign up with the Git provider).
- A free **Supabase** account + project → https://supabase.com (only if you want
  auth/persistence, not just the demo).

---

## 3. Set up Supabase (do this first)

Netlify needs the Supabase URL + key at build time, so create the backend first.

1. **Create a project** at https://supabase.com → *New project*. Pick a region
   close to your team, set a database password (save it), wait ~2 min for provisioning.

2. **Create the schema + seed data.** In the Supabase dashboard → **SQL Editor**,
   run these two files from this repo, in order:
   - `supabase/schema.sql`
   - `supabase/seed.sql`

   (See `supabase/README.md` for details on what these create.)

3. **Grab the API credentials.** Dashboard → **Settings → API Keys**. Copy:
   - **Project URL** → this becomes `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_...`) → this becomes
     `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

   > ⚠️ Use the **publishable** key, never the **secret** key. Only the publishable
   > key is safe in a `NEXT_PUBLIC_` variable — it's shipped to the browser and
   > relies on Row-Level Security. A secret key in `NEXT_PUBLIC_` would bypass RLS
   > and leak full database access to anyone viewing the page source.

Keep these two values handy — you'll paste them into Netlify in Section 4.

---

## 4. Deploy to Netlify

### 4a. Connect the repo

1. Netlify dashboard → **Add new site → Import an existing project**.
2. Authorize your Git provider and pick the **Beakon** repository.
3. Netlify auto-detects Next.js and pre-fills the build settings. Confirm they read:
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
   - **Branch to deploy:** `main`

   Netlify installs the **Next.js Runtime** (`@netlify/plugin-nextjs`)
   automatically — you don't need to add it yourself. Next.js 16 (App Router,
   Server Components, streaming) is officially supported.

### 4b. Add the environment variables

Still on the setup screen (or later under **Site configuration → Environment
variables**), add:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your `sb_publishable_...` key |
| `NODE_VERSION` | `20` |

Notes:
- `NEXT_PUBLIC_` vars are **inlined into the JS bundle at build time**, so they
  must exist *before* the build runs. If you add them after the first deploy, you
  must trigger a **rebuild** for them to take effect.
- Leave the scope as **All / Builds** — these are needed during the build.
- `NODE_VERSION=20` pins a Node version Next.js 16 supports (avoids build
  failures if Netlify's default drifts).

### 4c. Deploy

Click **Deploy**. First build takes a couple of minutes. When it's green you'll
get a URL like `https://beakon-xyz.netlify.app`.

At this point the **app loads**, but **login will not work yet** — finish Section 5.

---

## 5. Make magic-link login work (the critical step)

Beakon signs users in with a Supabase **magic link**. In `lib/auth.tsx` the link
redirects to `` `${window.location.origin}/timeline` ``  — i.e. back to whatever
domain served the app. Supabase will **refuse to send the user to any URL not on
its allow-list**, so you must register your Netlify domain.

In the Supabase dashboard → **Authentication → URL Configuration**:

1. **Site URL:** set to your Netlify URL, e.g. `https://beakon-xyz.netlify.app`
2. **Redirect URLs:** add:
   - `https://beakon-xyz.netlify.app/timeline`
   - *(optional, for Netlify Deploy Previews / branch deploys)*
     `https://*.netlify.app/timeline` — lets magic links work from preview builds too.

If you later add a **custom domain**, add its `/timeline` URL here as well.

> Symptom if you skip this: clicking the emailed link bounces you to
> `localhost:3000` or shows a "redirect URL not allowed" error.

---

## 6. Optional: pin config with `netlify.toml`

Auto-detection is enough, but committing a `netlify.toml` to the repo root makes
the build reproducible and self-documenting:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[build.environment]
  NODE_VERSION = "20"
```

(Secrets/keys still go in the Netlify UI, **never** in this committed file.)

---

## 7. Optional: custom domain

**Site configuration → Domain management → Add a domain.** Point your DNS at
Netlify (or use Netlify DNS). Netlify provisions a free HTTPS certificate
automatically. Remember to add the new domain's `/timeline` URL to Supabase
(Section 5).

---

## 8. Free-tier limits & what to watch

**Netlify Free plan (2026, credit-based):**
- ~300 credits/month ≈ **~15 GB bandwidth** + ~20 production deploys.
- 1 concurrent build, 1 team member.
- More than enough for an internal product-team tool. When you hit a cap the site
  keeps serving; you're prompted to upgrade rather than billed by surprise.

**Supabase Free plan — watch this one:**
- Projects **pause after ~1 week of no activity**. The first visitor after a quiet
  stretch wakes it (a few seconds), then it's normal. Fine for a team tool; just
  don't expect instant response after a long holiday.
- 500 MB database, 50k monthly active users, 1 GB file storage — far beyond
  Beakon's needs.

---

## 9. Post-deploy verification checklist

- [ ] Site loads at the Netlify URL.
- [ ] You see the **login screen** (not the demo) — confirms env vars took effect.
- [ ] Requesting a magic link sends an email.
- [ ] Clicking the link lands you on **`/timeline`, logged in** — confirms Section 5.
- [ ] Roadmap data loads from Supabase and edits persist across a refresh.

---

## 10. Everyday workflow after setup

- **Push to `main`** → Netlify auto-builds and deploys production.
- **Open a PR / push a branch** → Netlify posts a **Deploy Preview** URL so you can
  review changes on a real URL before merging (magic links there need the wildcard
  redirect from Section 5).
- **Change an env var** → trigger **Deploys → Trigger deploy → Clear cache and
  deploy** so the new `NEXT_PUBLIC_` value gets baked in.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|--------|--------------|-----|
| App shows demo/seed data, no login | Env vars missing or added after build | Add both `NEXT_PUBLIC_SUPABASE_*` vars, then rebuild |
| Magic link → `localhost` or "redirect not allowed" | Netlify URL not in Supabase allow-list | Add Site URL + `/timeline` redirect (Section 5) |
| Build fails on Node/engine error | Node version mismatch | Set `NODE_VERSION=20` |
| Env var change not reflected | `NEXT_PUBLIC_` is build-time only | Clear cache and redeploy |
| Slow first load after days idle | Supabase project paused | Expected on free tier; it wakes automatically |

---

### Sources

- [Next.js on Netlify — official setup](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)
- [Next.js 16 ready to deploy on Netlify](https://www.netlify.com/changelog/next-js-16-deploy-on-netlify/)
- [Netlify environment variables & deploy contexts](https://docs.netlify.com/build/environment-variables/overview/)
- [Netlify file-based config (`netlify.toml`)](https://docs.netlify.com/build/configure-builds/file-based-configuration/)
- [Netlify pricing & free plan](https://www.netlify.com/pricing/)
