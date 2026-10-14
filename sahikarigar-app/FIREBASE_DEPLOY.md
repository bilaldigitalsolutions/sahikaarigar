# 🚀 Firebase Deploy Guide (SahiKaarigar)

**✅ Site is LIVE:** https://sahi-kaarigar.web.app

This project deploys to Firebase Hosting on the **FREE (Spark) plan** — no Cloud
Functions, no Blaze plan, no credit card.

---

## 🧠 How it works (and why Blaze is not needed)

Next.js apps normally need Cloud Functions for server rendering + API routes, and
Cloud Functions require the paid Blaze plan.

We avoid that by **building a fully static site**:

```
next build (STATIC_EXPORT=1)  →  out/  →  firebase deploy --only hosting  →  CDN
        (static HTML/CSS/JS)      (files)      (free Spark plan)             (free SSL)
```

| Piece | Where it runs | Plan |
| --- | --- | --- |
| Website (HTML/CSS/JS) | Firebase Hosting CDN | **Spark — free** |
| Database + RLS + RPCs | Supabase (PostgreSQL) | **Free tier** |
| Phone OTP auth | Firebase Auth (client SDK) | **Spark — free** |
| Image storage | Supabase Storage | **Free tier** |

Two things make the static build possible (`next.config.js`):

1. `output: 'export'` → produces the `out/` folder instead of a server bundle.
2. `pageExtensions: ['tsx','jsx','js','mdx']` → **`ts` is deliberately omitted**,
   so Next ignores `src/app/api/**/route.ts`. Route Handlers cannot be exported,
   and this app's pages don't call them yet.
3. `images.unoptimized: true` → no Image Optimization function.

---

## 📦 Deploy (one command)

```powershell
cd d:\bilal-digital-solutions\sahikarigar\sahikarigar-app
npm run deploy
```

That runs:

```powershell
npm run build:static          # next build with STATIC_EXPORT=1  →  out/
firebase deploy --only hosting   # uploads out/ to the CDN
```

### Other useful commands

| Command | What it does |
| --- | --- |
| `npm run build:static` | Build the static site into `out/` only |
| `npm run deploy` | Static build + deploy to production |
| `npm run deploy:preview` | Temporary preview URL (7 days) |
| `npm run emulate` | Serve `out/` locally on http://localhost:5000 |
| `npm run dev` | Normal Next.js dev server (with API routes) |
| `npm run build` | Normal server build (for Vercel/Cloud Run later) |

> ⚠️ **Never run plain `firebase deploy` without `--only hosting`.** Without the
> flag the CLI tries to deploy Cloud Functions and asks for the Blaze plan.

---

## 🔍 What is NOT deployed in this mode

Everything under `src/app/**/page.tsx` ships in the static bundle — that is all
7 routes: `/`, `/search`, `/login`, `/register/employer`, `/register/worker`,
`/dashboard`, `/profile`.

What is **not** part of the deployed site are the Next.js **Route Handlers**:

- `src/app/api/workers/route.ts`
- `src/app/api/auth/verify/route.ts`

They stay in the repo and work fine with `npm run dev` / `npm run build`. They
just can't exist on a static host, which is exactly why login/registration go
through the Supabase **Edge Function** (`supabase/functions/auth`) instead — see
the next section. `/search` still renders demo data until the optional step
below is done.

### Making `/search` show real data (optional, next step)

Because the site is static, the browser can talk to **Supabase directly** with
the public `anon` key (that is the standard Supabase pattern):

1. Supabase → Project Settings → API → copy the **anon** key into
   `.env.local` **and** `.env.sahi-kaarigar` as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Add read-only RLS policies, e.g.

   ```sql
   -- public may read approved worker profiles (no phone numbers)
   create policy "Public read approved workers"
     on public.worker_profiles for select to anon
     using (is_approved = true);
   ```

3. Fetch in the page with `getSupabaseClient()` from `src/lib/supabase.ts`

⚠️ Never grant the `anon` role access to `public.users` — it contains phone
numbers. Use a view or the `worker_profiles` table only.

---

## 🔐 Login & Registration (how it works)

Firebase Phone Auth (OTP) + a Supabase **Edge Function** do the whole job — no
servers, no Blaze plan.

```
Browser                          Supabase Edge Function           Postgres
-------                          ----------------------           --------
1. Phone number -> OTP
   (Firebase Phone Auth, invisible reCAPTCHA)
2. Firebase ID token
3. POST /functions/v1/auth  ---> verify token vs Google's JWKS
   { action, token, ... }        (jose; no service-account key needed)
                                 |-- get / create  public.users
                                 `-- create        public.worker_profiles
                          <---   { ok, user }  ------------------>  rows
4. Firebase keeps the session; <AuthProvider> re-syncs on every page load
```

### Pages

| Route | What it does |
| --- | --- |
| `/login` | Phone + OTP login |
| `/register/employer` | Phone + OTP, then asks for a name |
| `/register/worker` | Phone + OTP, then the full worker profile form (skills, experience, rate, service areas) |
| `/dashboard` | Account summary, role-specific next steps, logout |
| `/profile` | Account details + logout |

### Edge function

| Item | Value |
| --- | --- |
| Source | `supabase/functions/auth/` |
| URL | `https://gkrgyurjifxtbffslzys.supabase.co/functions/v1/auth` |
| Secrets | **none** — `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are injected by the runtime and never reach the browser |
| Client code | `src/lib/auth-api.ts`, `src/lib/firebase.ts`, `src/components/providers/AuthProvider.tsx` |

Redeploy after editing:

```powershell
supabase functions deploy auth --no-verify-jwt
```

### Actions

| action | body | result |
| --- | --- | --- |
| `login` | `{ token, name? }` | `{ ok, user }` |
| `register-worker` | `{ token, name, profile }` | `{ ok, user, workerProfile }` |

New worker profiles are saved with `is_approved = false` — an admin approves them
before they show up in search.

### ⚠️ One-time Firebase Console checklist (do this before the first live test)

Work through these three items, **then click `Save`** (the toggle alone does not
persist — the Save button stays greyed until there is an unsaved change).

| # | Screen | Direct link | What to check |
| --- | --- | --- | --- |
| 1 | **Authentication → Sign-in method** | <https://console.firebase.google.com/project/sahi-kaarigar/authentication/providers> | `Phone` provider = **Enabled** → **Save** |
| 2 | **Authentication → Settings → Authorized domains** | <https://console.firebase.google.com/project/sahi-kaarigar/authentication/settings> | `sahi-kaarigar.web.app` **and** `localhost` are listed |
| 3 | **Authentication → Sign-in method → Phone → Phone numbers for testing** | same as #1 | Add `+91 9999999999` with code `123456` → **Save** |

> ⚠️ **Since 1 September 2024, sending SMS to *real* numbers requires a Cloud
> Billing account (Blaze plan).** On the free Spark plan, real numbers fail with
> `BILLING_NOT_ENABLED` — which the JS SDK often surfaces as
> `auth/operation-not-allowed`. **Registered test phone numbers are exempt** and
> still work on Spark, so a test number is what lets you develop for free.

**Why #2 matters:** if the domain is missing, the OTP call fails with
`auth/unauthorized-domain` (the panel already maps that to a Hindi error message).

**Why #3 matters:** on Spark this is the *only* way to exercise the OTP flow. A
test number sends **no SMS** — you just type the fixed code `123456`. Pick a
number that starts with **6–9** (the app validates `^[6-9]\d{9}$`), e.g.
`9999999999`.

**Going live with real numbers:** link a Cloud Billing account
(<https://console.firebase.google.com/project/sahi-kaarigar/usage>). On Blaze the
**first 10 SMS per day are free**, so a small launch stays at ₹0.

### 🧪 End-to-end test (register a worker)

1. Open <https://sahi-kaarigar.web.app/register/worker> in a normal browser tab.
2. Enter `9999999999` → **OTP Bhejo**. Because it is a registered test number,
   **no SMS is sent** — just type `123456`. (It must start with 6–9 to pass the
   in-app validation; a number like `1111111111` is rejected before any request.)
3. Fill the form (skills, experience, hourly rate, service areas) → submit.
4. You should land on `/dashboard?registered=1` showing the account summary.
5. Confirm the rows landed in Supabase (SQL Editor, or `npm run db:smoke` which
   reads the `users` table):

   ```sql
   select u.id, u.firebase_uid, u.phone, u.name, u.role,
          wp.skills, wp.experience, wp.hourly_rate, wp.service_areas, wp.is_approved
     from public.users u
     left join public.worker_profiles wp on wp.user_id = u.id
    order by u.created_at desc
    limit 1;
   ```

   A brand-new worker is saved with `is_approved = false` and will not appear in
   search until an admin approves it.

---

## 🌐 Custom domain (free)

Firebase Console → Hosting → **Add custom domain** → add the DNS records at your
registrar → Firebase issues a **free SSL certificate** automatically.

---

## 🧰 Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Cloud Functions API has not been used ...` | You ran `firebase deploy` without `--only hosting`. Use `npm run deploy`. |
| `Your project must be on the Blaze plan` | Same cause — the CLI tried to deploy a function. |
| `Route Handlers cannot be used with output: export` | `pageExtensions` in `next.config.js` was changed; make sure `ts` is not listed. |
| Site shows old content | Re-run `npm run deploy` (CDN caches immutable asset filenames only). |
| Local `npm run dev` uses a wrong Supabase key | A stale OS-level env var is overriding `.env.local`. Check with `[Environment]::GetEnvironmentVariables('User').Keys` and restart VS Code. |

---

## 📁 Files that matter

```
sahikarigar-app/
├── next.config.js          # static-export switch (STATIC_EXPORT)
├── firebase.json           # hosting: public dir = out/, cache + security headers
├── .firebaserc             # default project = sahi-kaarigar
├── .env.sahi-kaarigar      # 🔒 production env vars (gitignored)
├── scripts/build-static.mjs# runs `next build` with STATIC_EXPORT=1
└── out/                    # 🔒 generated static site (gitignored)
```
