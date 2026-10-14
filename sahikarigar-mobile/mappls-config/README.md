# Mappls SDK configuration files (Android)

These two files were downloaded from the **Mappls (MapmyIndia) Auth Console** for
app id **`app1791387035885i1076389007`**:

| File | Purpose |
| --- | --- |
| `app1791387035885i1076389007.a.olf` | Mappls SDK license blob (binary — do not edit) |
| `app1791387035885i1076389007.a.conf` | Mappls SDK configuration blob (binary — do not edit) |

The `.a.*` prefix means **Android**. (iOS uses `.i.conf` / `.i.olf` — download
those separately if you ever build for iOS.)

They are bound to the app's **package name + signing certificate SHA-256**, so the
Mappls console entry must match this project:

- Package name: `com.sahikarigar.app` (`app.json` → `expo.android.package`)

## ✅ These are copied automatically

`plugins/withMappls.js` (registered in `app.json`) copies both files into
`android/app/` every time you prebuild, and also adds the Mappls Maven repository.
So you only ever need to run:

```bash
npx expo prebuild --platform android
npx expo run:android          # or an EAS development build
```

> The generated `android/` folder is git-ignored, so `npx expo prebuild --clean`
> can always rebuild it from scratch.

## ⚠️ These are NOT the API key

These files only power the **native Mappls Maps SDK** (`mappls-map-react-native`),
which is used by the **Map screen** (`src/app/map.tsx`). The area **search** picker
uses the Mappls **REST APIs** (Autosuggest + Geocode) in `src/lib/mappls.ts`, which
authenticate with an **access token string** — get it from the console →
**Credentials** tab:

```env
EXPO_PUBLIC_MAPPLS_ACCESS_TOKEN=<paste the token here>
# or, to let the app fetch/refresh it automatically:
EXPO_PUBLIC_MAPPLS_CLIENT_ID=<client id>
EXPO_PUBLIC_MAPPLS_CLIENT_SECRET=<client secret>
```

## Where does the map work?

| Environment | Map screen |
| --- | --- |
| Expo Go / web | Shows a "needs a development build" notice (native modules can't load) |
| Development build / APK | Full interactive Mappls map ✅ |

## Notes

- The Mappls Gradle plugin searches `android/app/` (and a few sub-folders) for the
  `.a.olf` / `.a.conf` pair — the files must sit next to `android/app/build.gradle`.
- As per Mappls' terms, the Mappls logo & copyright on the map must stay visible.
- Usage quota is shared across all your Mappls apps (web/Android/iOS).

