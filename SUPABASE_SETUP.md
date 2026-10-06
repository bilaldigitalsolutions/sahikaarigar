# Supabase Setup (SahiKaarigar)

This project stores all data in **Supabase (PostgreSQL)**. Firebase is used
**only** for Phone Auth (OTP). There is no MongoDB/Mongoose anymore.

Supabase project: **Sahi Kaarigar**
Project URL: `https://kgnryuxrxfbztfzlsyz.supabase.co`

---

## 1. Run the SQL migrations

Open your Supabase project → **SQL Editor** → **New query**, then run the two
migration files **in order**:

1. `supabase/migrations/0001_init_schema.sql`
   - Creates the tables `users`, `worker_profiles`, `hire_requests`,
     `reviews`, `reports`
   - Adds indexes (including GIN indexes for `skills` / `service_areas`)
   - Adds `updated_at` triggers and the review → rating recalculation trigger
   - Creates the `search_workers`, `get_area_stats` and
     `increment_worker_completed_jobs` functions
   - Enables Row Level Security and denies all `anon` / `authenticated` access
2. `supabase/migrations/0002_storage.sql`
   - Creates the public `avatars` and `portfolio` Storage buckets

> Both files are idempotent — you can safely re-run them.

### Optional: install the Supabase CLI instead

```bash
npm i -g supabase
supabase login
supabase link --project-ref kgnryuxrxfbztfzlsyz
supabase db push
```

---

## 2. Copy the API keys

Supabase Dashboard → **Project Settings → API**:

| Key | Environment variable | Where it is used |
| --- | --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | client + server |
| `anon` / `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser (Storage reads) |
| `service_role` | `SUPABASE_SERVICE_ROLE_KEY` | **server only** |

Paste them into `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://kgnryuxrxfbztfzlsyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

> ⚠️ The `service_role` key bypasses Row Level Security. Never expose it to the
> browser and never prefix it with `NEXT_PUBLIC_`.

---

## 3. Create the bucket (if you skipped 0002)

Storage → **New bucket** → name `avatars`, enable **Public bucket**.
Repeat for `portfolio`.

---

## 4. Data model

```
users ─┬─< worker_profiles (1:1)
       ├─< hire_requests.employer_id
       ├─< reviews.reviewer_id
       └─< reports.reporter_id / reported_user_id

worker_profiles ─┬─< hire_requests.worker_id
                 └─< reviews.worker_id
```

| Table | Notes |
| --- | --- |
| `users` | `firebase_uid` (unique) links to the Firebase user, `phone` is unique and stored as 10 digits (e.g. `9876543210`) |
| `worker_profiles` | 1 row per worker, `rating_average` / `rating_count` are maintained by a trigger |
| `hire_requests` | `worker_id` references `worker_profiles.id` (not `users.id`) |
| `reviews` | one review per completed hire request (`hire_request_id` is unique) |
| `reports` | user reports for the admin queue |

Location is stored as `lat` / `lng` doubles (city / area are separate text
columns) so that distance search works **without PostGIS** — the
`search_workers` function uses the haversine formula.

---

## 5. Row Level Security

Auth is handled by Firebase, **not** Supabase Auth, and every database call
from Next.js goes through the `service_role` key (which bypasses RLS).

RLS is therefore enabled on every table **with no permissive policies** — the
public `anon` key can read and write nothing. Worker phone numbers stay private.

---

## 6. Verifying the migration

```sql
-- should return an empty list
select * from public.worker_profiles limit 5;

-- should not error
select * from public.search_workers(p_area => 'ameerpet', p_limit => 5);
```

If you get `permission denied for table ...`, the query is being run with the
`anon` role — that is expected from the browser. Server-side code uses the
`service_role` key, so it is unaffected.

---

## 7. Firebase Admin credentials (Phone Auth)

The `/api/auth/verify` endpoint verifies the Firebase ID token the client gets
after the phone OTP succeeds, so the server needs **Firebase Admin** access.

### Easiest way — just drop the JSON file in

1. Firebase Console → ⚙️ **Project settings** → **Service accounts** tab
   → **Generate new private key** → **Generate key**
2. A `.json` file downloads (e.g. `sahi-kaarigar-firebase-adminsdk-abcd1-1a2b3c.json`)
3. Rename it to **`firebase-service-account.json`** and put it in the project
   root (next to `package.json`):

```
sahikarigar-app/
├── firebase-service-account.json   <-- yahan
├── package.json
└── src/
```

That's it — `src/lib/firebase-admin.ts` finds it automatically.

> 🔒 This file is already listed in `.gitignore`, so it can never be pushed to
> GitHub. Never share or commit it.

### Alternative — environment variables

Instead of the file, copy the two values out of that JSON into `.env.local`:

```env
FIREBASE_PROJECT_ID=sahi-kaarigar
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@sahi-kaarigar.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
```

Keep `FIREBASE_PRIVATE_KEY` on a **single line**, wrapped in double quotes, with
the `\n` sequences left as literal backslash-n (the code converts them).

You can also point at a JSON file somewhere else:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=D:\secrets\sahi-kaarigar-service-account.json
```

---

## 8. Troubleshooting

### `Invalid API key` (HTTP 401) even though the key in `.env.local` is correct

**Next.js gives an OS environment variable precedence over `.env.local`.** If a
variable with the same name exists at the Windows *User* or *Machine* level (for
example a leftover `SUPABASE_SERVICE_ROLE_KEY` from another project), that stale
value is used instead of the one in `.env.local`.

Check:

```powershell
[Environment]::GetEnvironmentVariable('SUPABASE_SERVICE_ROLE_KEY','User')
[Environment]::GetEnvironmentVariable('SUPABASE_SERVICE_ROLE_KEY','Machine')
```

Remove a stale User-level value:

```powershell
[Environment]::SetEnvironmentVariable('SUPABASE_SERVICE_ROLE_KEY', $null, 'User')
```

Then **fully restart VS Code** (close every window) so new terminals pick up the
change — the already-running VS Code process keeps the old environment.

The same applies to `NEXT_PUBLIC_SUPABASE_URL`, `DATABASE_URL`, etc.

### `tenant/user postgres.<ref> not found`

The project ref or the pooler region is wrong. Double-check the Project URL in
the Supabase dashboard (there is a **Copy** button next to it) — a single wrong
character is enough.

### `password authentication failed`

The database password is wrong. Reset it from
**Project Settings → Database → Reset database password**, then URL-encode it in
`DATABASE_URL` (`@` → `%40`, `#` → `%23`, `$` → `%24`, `%` → `%25`).

### `permission denied for table ...` (HTTP 403)

The API roles have no table privileges — usually because the project was created
with *"Automatically expose new tables"* unchecked. Run
`supabase/migrations/0003_grants.sql`, or simply `npm run db:migrate` (it runs
every migration in order).


