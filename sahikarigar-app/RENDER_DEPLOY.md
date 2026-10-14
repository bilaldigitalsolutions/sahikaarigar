# 🚀 Deploy `auth-server` on Render (free, no card) — then go live

This gets the SuperTokens auth server onto the public internet so the deployed
site at `https://sahi-kaarigar.web.app` can actually sign users in.

> **Why a separate host?** The site is a *static* bundle on Firebase Hosting.
> SuperTokens needs a long-running Node server (its SDK has no Deno/serverless
> build), so it cannot live inside the static bundle.

```
Browser  https://sahi-kaarigar.web.app   (Firebase Hosting, static)
   │  supertokens-web-js  →  POST /auth/*   +  /me, /register-worker, /profile
   ▼
Render   https://sahikaarigar-auth.onrender.com   (auth-server, FREE, no card)
   │  sendSms → SMS provider (console | messagecentral | msg91 | …)
   ├─ Supabase (service_role)  →  public.users / public.worker_profiles
   └─ SuperTokens Core (Cloud free <5k MAU, or a self-hosted container)
```

---

## 💰 Cost & card check

| Piece | Plan | Card needed? |
| --- | --- | --- |
| Render web service | **Free** (512 MB RAM, <1 CPU) | **No** |
| SuperTokens Core | Cloud **free under 5,000 MAU**, or self-host | **No** |
| Supabase | existing free project | No |
| SMS | `console` = free; real SMS = Indian provider via UPI | No |

> ⚠️ Render **free** services **spin down when idle** and cold-start in ~30–60s.
> Fine for development and a small pilot; do **not** treat it as production.

---

## ✅ Prerequisites

* A **GitHub** account (Render deploys from a Git repo).
* A **Render** account — sign up at <https://dashboard.render.com> (free, no card).
* Your Supabase **service_role** key (in `.env.local`).

---

## Step 1 — Get a SuperTokens Core

Pick **one**:

### Option A — SuperTokens Cloud (easiest, recommended)

1. Sign up at <https://supertokens.com> → create a **Cloud** instance.
   Free under 5,000 monthly active users.
2. From the instance dashboard copy:
   * **Connection URI** → e.g. `https://<something>.supertokens.io`
   * **API key**

### Option B — self-host the Core on Render (free)

Render free services **cannot receive private-network traffic**, so the Core has
to be a *public* service protected by an API key.

1. Render → **New → Web Service → Deploy an existing image**.
2. Image: `supertokens/supertokens-postgresql:latest`, plan **Free**.
3. Env vars:
   * `POSTGRESQL_CONNECTION_URI` = your Supabase **Session pooler** URI
     (Supabase → Connect → Session pooler) — reuse the DB you already pay nothing for.
   * `API_KEYS` = a long random string (this is the API key).
4. Deploy, then set `SUPERTOKENS_CONNECTION_URI` to the Core's `https://…onrender.com`
   URL and `SUPERTOKENS_API_KEY` to that same random string.

### Option C — quick smoke test only

`SUPERTOKENS_CONNECTION_URI=https://try.supertokens.io` (SuperTokens' shared demo
Core). Great for a first "does it work" check. **Never for real users.**

---

## Step 2 — Push the code to GitHub

> ℹ️ This project has **no Git repository yet**, so start one. It also protects
> you from accidental changes — there is currently no version history at all.

```powershell
cd d:\bilal-digital-solutions\sahikarigar\sahikarigar-app

git init
git add .
git commit -m "SahiKaarigar: SuperTokens phone OTP auth"
git branch -M main

# create an EMPTY repo on github.com named sahikarigar-app, then:
git remote add origin https://github.com/<YOUR-USERNAME>/sahikarigar-app.git
git push -u origin main
```

**Verify no secrets were committed** (this must print nothing):

```powershell
git ls-files | Select-String -Pattern "\.env$|\.env\.local|\.env\.sahi-kaarigar|service-account|adminsdk"
```

`.env.example` files *should* be committed; real `.env*` files, the Firebase
service-account JSON, `node_modules`, `out/` and `.next/` are already ignored.

---

## Step 3 — Create the Render web service

### Option A — Blueprint (uses the included `render.yaml`)

Render → **New → Blueprint** → pick the repo → **Apply**.
`render.yaml` already sets the root dir, build/start commands, health check and
the non-secret env vars. You only fill the `sync: false` ones (Step 4).

### Option B — manual

Render → **New → Web Service** → connect the repo, then:

| Setting | Value |
| --- | --- |
| Root Directory | `auth-server` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/health` |
| Instance Type | **Free** |
| Region | Singapore (closest to India) |

---

## Step 4 — Environment variables

Add these in Render → your service → **Environment**:

| Key | Value |
| --- | --- |
| `SUPERTOKENS_CONNECTION_URI` | from Step 1 (e.g. `https://xxx.supertokens.io`) |
| `SUPERTOKENS_API_KEY` | from Step 1 (blank if your Core has no key) |
| `SUPABASE_URL` | `https://gkrgyurjifxtbfffslzys.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | copy from `.env.local` — **secret** |
| `WEBSITE_DOMAIN` | `https://sahi-kaarigar.web.app` |
| `SMS_PROVIDER` | `console` (dev) — later `messagecentral` for real SMS |
| `NODE_VERSION` | `20` |

`API_DOMAIN` is **not** needed — the server reads Render's `RENDER_EXTERNAL_URL`.
`PORT` is also injected by Render.

Save → Render redeploys automatically.

---

## Step 5 — Verify it is alive

```powershell
curl https://<your-service>.onrender.com/health
# {"ok":true,"smsProvider":"console","supportedSmsProviders":["console",...]}
```

> ⏳ The **first** request after idle can take 30–60s (free tier cold start).
> If it times out, just retry.

---

## Step 6 — Point the app at it and deploy

Edit `.env.sahi-kaarigar` (production env for the build):

```env
NEXT_PUBLIC_AUTH_API_URL=https://<your-service>.onrender.com
```

Then:

```powershell
cd d:\bilal-digital-solutions\sahikarigar\sahikarigar-app
npm run deploy
```

`scripts/build-static.mjs` prints the URL it baked in — confirm it is the Render
URL and **not** `localhost`:

```
▶ Building static export (out/) — no Cloud Functions needed
  auth API: https://sahikaarigar-auth.onrender.com
```

---

## Step 7 — End-to-end test on the live site

1. Open <https://sahi-kaarigar.web.app/register/worker>.
2. Enter any valid 10-digit number starting with 6–9, e.g. `9999999999` →
   **OTP Bhejo**.
3. With `SMS_PROVIDER=console` the code is **not texted** — read it from
   Render → your service → **Logs**:
   ```
   [SMS:console] OTP for +9199999999 -> 483920
   ```
4. Type the code → fill the worker form → submit → you land on `/dashboard`.
5. Confirm the rows in Supabase:

   ```sql
   select u.id, u.phone, u.name, u.role, u.auth_user_id,
          wp.skills, wp.hourly_rate, wp.is_approved
     from public.users u
     left join public.worker_profiles wp on wp.user_id = u.id
    order by u.created_at desc limit 1;
   ```

For **real SMS**, set `SMS_PROVIDER=messagecentral` (plus its credentials) in
Render — no redeploy of the site needed.

---

## ⚠️ Render free-tier caveats

| Caveat | Impact |
| --- | --- |
| **Spins down when idle** | first request after ~15 min takes 30–60s. The OTP call itself may time out on a cold start — retry. |
| **512 MB RAM, <1 CPU** | fine for auth; not for anything heavy. |
| **No persistent disk** | local files are lost on redeploy. `auth-server` is stateless, so no problem. |
| **No SSH / shell** | use Render's Logs tab. |
| **Can't receive private-network traffic** | a self-hosted Core must be a public service (protect it with `API_KEYS`). |
| **750 instance-hours/month** | shared across free services. |

---

## 🧯 Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Live site says *"Auth server configure nahi hai"* | `NEXT_PUBLIC_AUTH_API_URL` was empty at build time. Set it in `.env.sahi-kaarigar` and `npm run deploy`. |
| Browser console: **CORS** error | `WEBSITE_DOMAIN` on Render must be exactly `https://sahi-kaarigar.web.app` (no trailing slash), then redeploy the service. |
| **Login succeeds but the session disappears** (most common!) | The site (`…web.app`) and the API (`…onrender.com`) are *different sites*, so a cookie session would be a **third-party cookie** and gets blocked. Already fixed: the frontend uses **header-based sessions** (`Session.init({ tokenTransferMethod: 'header' })`) — see below. |
| `/health` times out | Free-tier cold start — retry once. |
| **Deploy fails: `Error: Node.js detected but native WebSocket not found`** | Render was running **Node 20**. `@supabase/supabase-js` (>=2.50) needs Node's native `WebSocket`, which only exists from **Node 22**. `render.yaml` sets `NODE_VERSION=22`; make sure it is not overridden in the dashboard. |
| `502 Bad Gateway` | the service crashed; check Logs (usually a missing env var). |
| OTP never arrives | `SMS_PROVIDER=console` prints it in the logs instead of texting. For real SMS set an Indian provider; on `msg91`/`fast2sms` the usual cause is missing **DLT registration**. |
| `Phone number is missing or invalid` | number not 10 digits starting 6–9, or the frontend sent it without `+91`. |
| `superTokens.getUser failed` in logs | `SUPERTOKENS_API_KEY` doesn't match the Core. |

### 🔧 Cross-site cookies — ✅ already fixed in code (header-based sessions)

The site (`…web.app`) and the API (`…onrender.com`) are *different sites*, so a
session cookie would be a **third-party cookie** and Safari/Chrome block those.
The app therefore uses **header-based sessions**: `src/lib/supertokens.ts` is
already configured with

```ts
recipeList: [
  Session.init({ tokenTransferMethod: 'header' }), // ← NOT the default ('cookie')
  Passwordless.init(),
],
```

The SDK then sends `st-auth-mode: header`, stores the tokens in `localStorage`,
and attaches `Authorization: Bearer <access-token>` to every call to the
auth-server (including `/me` and `/register-worker`). Verified end-to-end:
`OPTIONS /me` returns `access-control-allow-headers: …authorization…`.

The backend needs **no** change — by default it follows whatever the frontend
sends in `st-auth-mode` (`auth-server/src/index.js` can stay `Session.init()`).

> Trade-off: header mode keeps tokens in browser storage, which is more exposed
> to XSS than an `HttpOnly` cookie. This app renders no user-supplied HTML, so
> the risk is low — but it is a real trade-off.

To go back to cookies (only sensible if the site and API share a domain), change
it to `Session.init()` and redeploy.

---

## 💰 Final cost

| Item | Cost |
| --- | --- |
| Firebase Hosting (static site) | ₹0 |
| Supabase (DB + storage) | ₹0 |
| Render web service (free plan) | ₹0 |
| SuperTokens Cloud (<5,000 MAU) | ₹0 |
| SMS — `console` (dev) | ₹0 |
| SMS — real numbers (Message Central) | ~₹0.30 per OTP |

**No credit card is required anywhere in this setup.**

---

## ✅ Final checklist

Done already (verified this session):

- [x] **SuperTokens Core** created — Cloud / Managed Service, *Sahi Kaarigar*,
      Development, **Singapore (ap-southeast-1)**
      → `SUPERTOKENS_CONNECTION_URI` + `SUPERTOKENS_API_KEY` are in
      `auth-server/.env`; `npm run check-core` returns `HTTP 200 Hello` and the
      SDK accepts the key.
- [x] **DB migration** `0004_supertokens.sql` applied (`users.auth_user_id`
      exists, `firebase_uid` nullable) — `npm run db:migrate`.
- [x] **Local end-to-end** verified against the real Core + Supabase:
      OTP generated → delivered (console) → consumed → session issued →
      `GET /me` created the `users` row → `POST /register-worker` set
      `role=worker`. Test rows were cleaned up.
- [x] **Header-based sessions** wired for the cross-site production setup.
- [x] **Git repo** initialised + first commit on `main` (audited: no `.env`,
      no service-account key committed).

Still to do (needs your GitHub + Render accounts):

- [ ] Push to GitHub (`git remote add origin …` then `git push -u origin main`)
- [ ] Render web service created (root dir `auth-server`, plan **Free**)
- [ ] Env vars set (`SUPERTOKENS_*`, `SUPABASE_*`, `WEBSITE_DOMAIN`)
- [ ] `https://<service>.onrender.com/health` returns `{"ok":true,…}`
- [ ] `.env.sahi-kaarigar` → `NEXT_PUBLIC_AUTH_API_URL=https://<service>.onrender.com`
- [ ] `npm run deploy` (build log shows the Render URL, not localhost)
- [ ] Live test: OTP → form → row appears in Supabase `users` + `worker_profiles`
- [ ] (later) switch `SMS_PROVIDER` to a real Indian provider
