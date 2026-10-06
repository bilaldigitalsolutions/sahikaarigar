# 🔐 SuperTokens Setup (phone OTP) — SahiKaarigar

**Goal:** run phone-OTP login on **self-hosted SuperTokens + an Indian SMS
provider**, so no credit card is required — replacing Firebase Phone Auth (which
has required a Cloud Billing account for SMS since Sept 2024).

> ⚠️ **Read this first — what this actually costs you.**
>
> SuperTokens does **not** send SMS itself. It *generates* the OTP; **we deliver
> it** through whichever provider you pick. So:
>
> * **No card needed** if you use `console` (development) or an Indian provider
>   that takes UPI — `messagecentral` (VerifyNow) is **DLT-free at ~₹0.30/OTP**.
> * You must run **two** services: the SuperTokens **Core** and this
>   **auth-server**. SuperTokens Cloud is free under **5,000 MAU** and removes
>   the Core hosting; the auth-server still needs an always-on Node host
>   (Render's free tier works, no card).
> * For the absolute lowest effort, Firebase Blaze paid via **UPI** (10 free
>   SMS/day) is less work. This document is the *full* SuperTokens route.

---

## 1. Architecture

```
Browser (static site on Firebase Hosting)
  │  supertokens-web-js
  │     POST /auth/signinup/code          (create + SMS an OTP)
  │     POST /auth/signinup/code/consume  (verify OTP -> session cookie)
  ▼
auth-server/            (Express + supertokens-node)   <- always-on Node host
  ├── Passwordless recipe  (PHONE + USER_INPUT_CODE)   no reCAPTCHA needed
  ├── sendSms override ──► src/sms.js ──► console | msg91 | fast2sms
  │                                        | messagecentral | twilio
  ├── GET /me, POST /register-worker ──► Supabase (service_role key)
  └── talks to ▼
SuperTokens Core  (Docker, or SuperTokens Cloud)       <- NEVER public
        └── PostgreSQL (its own, or your existing Supabase Postgres)
```

Only `auth-server` may talk to the Core. The Core exposes admin APIs, so it must
stay on a private network behind an API key (`auth-server/README.md`).

---

## 2. Components & where they live

| Piece | Folder / service | Hosted where | Card? |
| --- | --- | --- | --- |
| Frontend SDK | `src/lib/supertokens.ts` | Firebase Hosting (static) | no |
| Phone panel | `src/components/auth/SuperTokensPhonePanel.tsx` | ditto | no |
| Session provider | `src/components/providers/SuperTokensAuthProvider.tsx` | ditto | no |
| Reference migrations | `supabase/migrations/0004_supertokens.sql` | local | no |
| **auth-server** | `auth-server/` | Render / Railway / Fly / VM | no |
| **SuperTokens Core** | `auth-server/docker-compose.yml` or Cloud | private network | no |
| **SMS provider** | `auth-server/src/sms.js` | their API | see below |

### SMS provider options

| `SMS_PROVIDER` | Country | Cost | Card? | DLT registration? |
| --- | --- | --- | --- | --- |
| `console` | — (dev) | **free** | no | no |
| `messagecentral` | India | **₹0.30 / OTP** | no (UPI) | **not required** |
| `msg91` | India | ~₹0.15 / SMS | no (UPI) | required |
| `fast2sms` | India | ~₹0.15 / SMS | no (UPI) | required |
| `twilio` | global | Twilio rate + 20% | **yes** | n/a |

Adding another provider = one function in `src/sms.js` (same `({ phone, otp })`
signature).

---

## 3. Environment variables

Frontend (`.env.local` / `.env.sahi-kaarigar`):

```env
# Leave empty to keep using Firebase. Set it to point at auth-server.
NEXT_PUBLIC_AUTH_API_URL=
```

`auth-server/.env` — see `auth-server/.env.example`. Minimum:

```env
API_DOMAIN=http://localhost:4000
WEBSITE_DOMAIN=http://localhost:3000
SUPERTOKENS_CONNECTION_URI=http://localhost:3567
SUPERTOKENS_API_KEY=
SUPABASE_URL=https://gkrgyurjifxtbfffslzys.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SMS_PROVIDER=console
```

---

## 4. Bring it up (≈10 minutes, zero cost)

```powershell
# 1. frontend dependency
cd d:\bilal-digital-solutions\sahikarigar\sahikarigar-app
npm install

# 2. SuperTokens Core (Docker) -> http://localhost:3567
cd auth-server
docker compose up -d

# 3. auth-server
copy .env.example .env      # then fill SUPERTOKENS_API_KEY / SUPABASE_SERVICE_ROLE_KEY
npm install
npm start
```

Sanity checks:

```powershell
curl http://localhost:4000/health
# {"ok":true,"smsProvider":"console","supportedSmsProviders":["console",...]}
```

With `SMS_PROVIDER=console` **no SMS is sent** — the OTP is printed in the
auth-server terminal:

```
[SMS:console] OTP for +919999999999 -> 483920
```

Type that code into the UI. The full flow (create code → consume → session →
`/me` → Supabase row) is now testable end-to-end, free and card-free.

Going live with real SMS:

1. Create an account with **Message Central (VerifyNow)** — DLT-free, ~₹0.30/OTP.
2. Put `MESSAGECENTRAL_CUSTOMER_ID` / `MESSAGECENTRAL_PASSWORD` in `.env`.
3. Set `SMS_PROVIDER=messagecentral` and restart.

```powershell
# 4. apply the DB migration (adds users.auth_user_id, makes firebase_uid nullable)
cd ..
npm run db:migrate
```

---

## 5. Wiring — ✅ DONE

The app now authenticates **only** through SuperTokens. Firebase Phone Auth is
gone from the shipped bundle (verified: no `AIzaSy…` key anywhere in `out/`).

| Where | What it uses now |
| --- | --- |
| `src/app/layout.tsx` | `<AuthProvider>` — re-exported from `SuperTokensAuthProvider` in `src/components/providers/index.ts` |
| `Header`, `/dashboard`, `/profile` | `useAuth()` — the same re-export |
| `/login`, `/register/employer`, `/register/worker` | `<SuperTokensPhonePanel>` |
| `/register/worker` submit | `registerWorkerViaSuperTokens(...)` → `POST /register-worker` |
| `/register/employer` submit | `updateProfile({ name })` → `POST /profile` |
| `/login` submit | `refresh()` only — the session already exists after the OTP |

Because the SuperTokens provider is re-exported under the generic names
`AuthProvider` / `useAuth`, **no page needed an import change**.

Kept on disk for reference but no longer bundled: `PhoneAuthPanel.tsx`,
`AuthProvider.tsx`, `src/lib/firebase.ts`, `src/lib/auth-api.ts`.

### What is still required

* **Local dev works today** — `NEXT_PUBLIC_AUTH_API_URL=http://localhost:4000`
  in `.env.local` (see §4).
* **The deployed site needs a PUBLIC auth-server.** `https://…web.app` is https,
  so it cannot call `http://localhost:4000` (mixed content + CORS). Deploy
  `auth-server/` to Render / Railway / Fly (free tiers, no card), then put the
  URL in `.env.sahi-kaarigar` and run `npm run deploy`.
* Until that URL exists, auth on the live site shows
  *"Auth server configure nahi hai"*. `scripts/build-static.mjs` reads
  `.env.sahi-kaarigar` **on top of** `.env.local`, so a production build can
  never bake in `localhost` (verified).


Then redeploy:

```powershell
npm run deploy
```

> Sessions are **header-based** (`tokenTransferMethod: 'header'`), because the
> site (`…web.app`) and the auth-server (`…onrender.com`) are different sites and
> a cookie would be a blocked third-party cookie. The SDK stores the tokens and
> sends `Authorization: Bearer …` on every call (already handled in
> `src/lib/supertokens.ts`).

---

## 6. Rollback

Set `NEXT_PUBLIC_AUTH_API_URL=` (empty), switch the provider import back to
`AuthProvider`, and redeploy. Existing SuperTokens users keep their rows
(`auth_user_id` is set); Firebase users keep theirs (`firebase_uid` is set).

---

## 7. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `SUPERTOKENS_CONNECTION_URI is not set` | `.env` missing — `copy .env.example .env` |
| `Login failed: fetch failed` / health check fails | Core not running — `docker compose up -d` |
| OTP printed but login fails | `SUPERTOKENS_API_KEY` differs between `.env` and `docker-compose.yml` |
| Browser console: CORS error | `WEBSITE_DOMAIN` must exactly match the site origin (no trailing slash) |
| Session cookie not saved | Not used — the app runs **header-based sessions** (`tokenTransferMethod: 'header'`). If you switch back to cookies, the site and API must share a domain, and production must be **https** |
| `Phone number is missing or invalid` | Non-Indian number, or frontend sent the number without `+91` |
| `auth_user_id` unique violation | Same phone signed up twice — check `users.phone` (it is already unique) |
| Real SMS never arrives | Check provider credentials; on `msg91`/`fast2sms` it is almost always missing **DLT registration** |
