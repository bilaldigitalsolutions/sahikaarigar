# 📱 SahiKaarigar Mobile

React Native (Expo) Android app for **SahiKaarigar** — Hyderabad ke best workers
(electrician, plumber, painter, …) dhundho aur seedha hire karo.

Ye app website (`../sahikarigar-app`) ke **same backend** ko use karta hai:

- **Auth** — SuperTokens passwordless phone OTP via `auth-server/` (Express)
- **Data** — wahi REST API (`/workers`, `/hires`, `/reviews`, …)

## 🛠️ Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Expo SDK 57 + React Native 0.86 |
| Language | TypeScript (strict) |
| Routing | Expo Router (file-based, `src/app/`) |
| Auth | `supertokens-react-native` (session) + passwordless REST |
| UI | Hand-rolled design system (`src/components/ui`) matching the web theme |

## ✅ Prerequisites

- Node.js 18+ and npm
- **Expo Go** app (phone) **or** an Android emulator (Android Studio)
- The auth-server must be reachable (defaults to the production Render URL)

## 🚀 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure env (already created from .env.example — edit if needed)
#    EXPO_PUBLIC_AUTH_API_URL = https://sahikaarigar-auth.onrender.com

# 3. Start the dev server
npm start          # then press "a" for Android, or scan the QR with Expo Go
npm run android    # launch straight into an emulator/device
```

### Local backend (optional)

If you run the auth-server locally, point the app at it:

| Target | `EXPO_PUBLIC_AUTH_API_URL` |
| --- | --- |
| Android emulator | `http://10.0.2.2:4000` |
| Physical device | `http://<your-lan-ip>:4000` |
| Production | `https://sahikaarigar-auth.onrender.com` |

## 📁 Project Structure

```
src/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root providers + Stack
│   ├── index.tsx           # Auth-based redirect
│   ├── (auth)/             # login.tsx (phone) + verify.tsx (OTP)
│   ├── (tabs)/             # index (search) · hires · profile
│   ├── worker/[id].tsx     # Worker detail + reviews
│   └── hire/[workerId].tsx # Create a hire request
├── components/
│   ├── ui/                 # Button, Card, Input, Badge, Avatar, Rating, Screen
│   ├── WorkerCard.tsx
│   ├── HireCard.tsx
│   └── EmptyState.tsx
├── contexts/AuthContext.tsx
├── lib/                    # config, auth (SuperTokens), api client, mappers
├── theme/                  # design tokens (mirrors tailwind.config.js)
├── types/                  # domain types
├── constants/              # SKILLS, HYDERABAD_AREAS, validation
└── utils/                  # formatters, phone helpers
```

## 🔐 How Auth Works

1. **Login** → `POST /auth/signinup/code` (phone) → returns `preAuthSessionId` + `deviceId`
2. **Verify** → `POST /auth/signinup/code/consume` (OTP) → SuperTokens creates the session
3. `supertokens-react-native` **captures the tokens** (it patches global `fetch`) and
   attaches `Authorization: Bearer …` to every later API call — no cookies needed.

> With `SMS_PROVIDER=console` on the server, the OTP is returned in the response
> and shown on the verify screen (dev only).

## 🧪 Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run android` | Run on Android |
| `npm run web` | Run in the browser (handy for quick UI checks) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `expo lint` |

## 📦 Building a release (EAS)

```bash
npm i -g eas-cli
eas login
eas build:configure
eas build -p android --profile production   # produces an .aab for Play Store
```

## 🔜 Next Steps

- Push notifications ✅ (`expo-notifications` — hire status changes ping the user; server side in `auth-server/src/push.js`)
- Location-based search ✅ (`expo-location` — "near me" sorting + live GPS shared on en_route / arrived)
- Mappls / Google Places API keys (`.env`) — optional; the area picker already falls back to the keyless Photon geocoder
- Play Store launch — EAS build is ready; upload the AAB from the EAS dashboard
