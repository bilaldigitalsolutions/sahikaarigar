# SahiKaarigar `auth-server`

SuperTokens **passwordless phone OTP** on the server side. It replaces Firebase
Phone Auth **and** the Supabase Edge Function `auth`:

```
Browser (static site on Firebase Hosting)
  └─ supertokens-web-js  ──POST /auth/*──▶  auth-server (Express)
                                              ├─ SuperTokens Core
                                              └─ sendSms ─▶ SMS provider API
                                            ──/me, /register-worker──▶ Supabase
```

SuperTokens creates the code; **this server delivers it** through whichever
provider `SMS_PROVIDER` selects — so you are never locked into Twilio.

## Quickstart (costs nothing, needs no account)

```powershell
cd auth-server
npm install
copy .env.example .env      # Windows   (cp on macOS/Linux)
npm start
```

With `SMS_PROVIDER=console` the OTP is simply **printed in the terminal** — no
SMS account, no card, no cost. Perfect for building and testing the whole flow.

You still need a SuperTokens Core. Easiest:

```powershell
docker compose up -d        # Core on http://localhost:3567 (see docker-compose.yml)
```

…or sign up for **SuperTokens Cloud** (free under 5,000 monthly active users)
and set `SUPERTOKENS_CONNECTION_URI` + `SUPERTOKENS_API_KEY` to the values from
its dashboard.

## SMS providers

| `SMS_PROVIDER` | Where | Cost | Card? | DLT? |
| --- | --- | --- | --- | --- |
| `console` | dev only | **free** | no | no |
| `startmessaging` | India | **₹0.25 / OTP** | no (UPI) | **not needed** — accepts our OTP |
| `messagecentral` | India | **₹0.30 / OTP** | no (UPI) | **not needed** |
| `msg91` | India | ~₹0.15 / SMS | no (UPI) | required |
| `fast2sms` | India | ~₹0.25 / OTP (Quick SMS ≈ ₹5) | no (UPI) | SMS route: **yes** · WhatsApp / Quick SMS: no |
| `twilio` | global | Twilio rate + 20% | **yes** | n/a |

Adding a provider = one function in `src/sms.js` (same `({ phone, otp })` shape).

Verify a provider's credentials without going through the whole login flow:

```powershell
npm run test-sms -- 9876543210     # sends ONE real OTP via the selected provider
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/signinup/code` | ask SuperTokens to create + send an OTP |
| `POST` | `/auth/signinup/code/consume` | verify the OTP and create the session |
| `POST` | `/auth/signout` | end the session |
| `GET` | `/me` | signed-in user's Supabase row (creates it on first login) |
| `POST` | `/register-worker` | upsert the worker profile (session protected) |
| `POST` | `/admin/login` | Admin email/password login |
| `GET` | `/admin/session` | Verify the current admin session |
| `GET` / `PATCH` | `/admin/workers` | Admin-only worker review queue and decisions |
| `GET` / `PATCH` | `/admin/users`, `/admin/hires` | Admin-only user and hire management |
| `GET` | `/admin/stats` | Admin-only dashboard counts |
| `GET` | `/health` | liveness + active SMS provider |

The `/auth/*` paths are managed by SuperTokens — call them with the
`supertokens-web-js` SDK, not by hand.

## Environment

See `.env.example`. Required: `SUPERTOKENS_CONNECTION_URI`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`. In production also set `API_DOMAIN`,
`WEBSITE_DOMAIN` (the `https://sahi-kaarigar.web.app` origin) and an API key.
Configure `ADMIN_EMAIL`, a unique strong `ADMIN_PASSWORD`, and a separate
random `ADMIN_SESSION_SECRET` of at least 32 characters on the auth-server host.
These values must never be added to frontend `NEXT_PUBLIC_*` variables. Admin
login issues a four-hour signed token and throttles failed attempts. Admin
pages require this email/password session; the user app continues to use
SuperTokens phone OTP.

## Deploying

Any always-on Node host works (Render free tier, Railway, Fly.io, a VM). The
server is a normal Express app — `npm start` with the env vars set.

> ⚠️ The SuperTokens **Core must not be reachable from the internet**. Put it on
> a private network and set an API key. Only `auth-server` may talk to it.

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — it must only ever live in this
  server's environment, never in the browser bundle.
- Aadhaar images are stored in the private `aadhaar-documents` bucket and only
  admin review responses receive a five-minute signed image URL.
- The frontend SuperTokens SDK manages the session and attaches its session
  tokens to requests to the auth-server.
- Admin session tokens are separately signed, short-lived, and held in
  sessionStorage; rotate `ADMIN_SESSION_SECRET` to invalidate issued tokens.
- Every database write goes through this server, exactly like the edge function
  it replaces.
