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
| `messagecentral` | India | **₹0.30 / OTP** | no (UPI) | **not needed** |
| `msg91` | India | ~₹0.15 / SMS | no (UPI) | required |
| `fast2sms` | India | plan rate; Quick SMS = premium | no (UPI) | **not needed** |
| `twilio` | global | Twilio rate + 20% | **yes** | n/a |

Adding a provider = one function in `src/sms.js` (same `({ phone, otp })` shape).

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/signinup/code` | ask SuperTokens to create + send an OTP |
| `POST` | `/auth/signinup/code/consume` | verify the OTP and create the session |
| `POST` | `/auth/signout` | end the session |
| `GET` | `/me` | signed-in user's Supabase row (creates it on first login) |
| `POST` | `/register-worker` | upsert the worker profile (session protected) |
| `GET` | `/health` | liveness + active SMS provider |

The `/auth/*` paths are managed by SuperTokens — call them with the
`supertokens-web-js` SDK, not by hand.

## Environment

See `.env.example`. Required: `SUPERTOKENS_CONNECTION_URI`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`. In production also set `API_DOMAIN`,
`WEBSITE_DOMAIN` (the `https://sahi-kaarigar.web.app` origin) and an API key.

## Deploying

Any always-on Node host works (Render free tier, Railway, Fly.io, a VM). The
server is a normal Express app — `npm start` with the env vars set.

> ⚠️ The SuperTokens **Core must not be reachable from the internet**. Put it on
> a private network and set an API key. Only `auth-server` may talk to it.

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — it must only ever live in this
  server's environment, never in the browser bundle.
- Sessions are HTTP-only cookies; the frontend sends `credentials: 'include'`.
- Every database write goes through this server, exactly like the edge function
  it replaces.
