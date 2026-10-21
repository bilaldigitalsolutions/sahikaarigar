# SAHIADMIN — COMPLETE ADMIN PANEL AUDIT REPORT

**Auditor:** Senior QA Engineer / Security Auditor
**Date:** 2026-10-21
**Scope:** Web Admin Panel (SahiAdmin)
**Audited surface:**
- Frontend (active admin SPA): `sahikarigar-app/src/app/admin/*`, `sahikarigar-app/src/components/admin/*`, `sahikarigar-app/src/lib/api.ts`
- Backend API: `auth-server/src/admin.js`, `auth-server/src/index.js`, `auth-server/src/users.js`
- Legacy/duplicate admin: `src/app/admin/page.tsx`, `src/lib/api.ts`
- Schema: `supabase/migrations/*.sql`

> **Repository note (finding in itself):** There are **two** admin implementations in this repo: an older one at `src/app/admin/page.tsx` (root Next app, phone/`ADMIN_PHONES`-based) and the active, feature-complete one at `sahikarigar-app/src/app/admin/*` (email/password + HMAC token). The findings below audit the **active `sahikarigar-app` panel** and its `auth-server` backend, and flag the legacy copy where relevant. All `File:Line` references point to the exact source audited.

---

## 1. HIRE REQUESTS PAGE (Data Accuracy & Logic)

**Files traced:** `sahikarigar-app/src/app/admin/hires/page.tsx` · `sahikarigar-app/src/lib/api.ts:502-538` · `auth-server/src/admin.js:389-483` · `auth-server/src/index.js:883-911`

### Trace of the endpoint
1. `AdminHiresPage` calls `listAdminHires(filter, page)` (`hires/page.tsx:84`).
2. `listAdminHires` → `adminApiFetch('/admin/hires?status=…&page=…')` (`api.ts:532-537`).
3. Server route `GET /admin/hires` → `requireAdmin()` → `listAdminHires()` (`index.js:883-892`).
4. `listAdminHires()` selects the hire row + joined employer/worker (`admin.js:435-483`), then calls `workerPerformanceMap()` (`admin.js:404-433`) to compute **per-worker aggregates from the entire `hire_requests` table**, and attaches them as `worker.performance` and top-level `workerPerformance`.
5. Frontend renders the **hire's own** `hire.status` badge (`hires/page.tsx:234-240`) while rendering the **worker's global** `performance` pills (`hires/page.tsx:176, 232`).

### Findings

| Issue ID | Component/Page | Severity | Description | File:Line Reference | Recommended Fix |
|---|---|---|---|---|---|
| HR-01 | Hire Requests — Status vs. badges mismatch | **High** | The main `Status` badge is the **hire-request's** status, but the "Accepted / Rejected / Completed" pills are the worker's **lifetime aggregate across ALL hire requests** (`workerPerformanceMap` scans every row in `hire_requests` for that `worker_id`). They are two different scopes, so a row reading `Status = Completed` can legitimately show `Accepted: 0` (e.g. worker accepted a *different* job) and vice-versa. This is the root cause of the reported contradiction. | `hires/page.tsx:176,232` reads `hire.worker?.performance ?? hire.workerPerformance`; built in `admin.js:404-433,450-474` | Either (a) remove the lifetime pills from the per-request row, or (b) relabel them clearly as "Worker lifetime stats" and move them to a worker column/tooltip, or (c) compute per-request-relative stats. Never present global aggregates as if they describe the row's own status. |
| HR-02 | Perf pill semantics | **Med** | `accepted` is defined as `['accepted','en_route','arrived','in_progress']` (`admin.js:420`). The UI labels this simply "Accepted", so in-flight jobs inflate the "accepted" count and `accepted + rejected + completed + cancelled + pending` need not equal `total` intuitively to the admin. | `admin.js:416-430`; pill label `hires/page.tsx:62` | Document/label as "Accepted (incl. active)" or split the buckets so the badges are self-explanatory. |
| HR-03 | Default name "User" shown as real data | **High** | New users are inserted with the literal name `'User'` when no name is supplied (`users.js:87`). The hires page prints `hire.employer?.name` / `hire.worker?.name` verbatim (`hires/page.tsx:207,221`), so rows show garbage like `User` for both parties. No "Name Not Set"/"Unknown" mapping exists for hires (only `reports/page.tsx:164,172` does this). | `users.js:62-89` (default `'User'`); display `hires/page.tsx:207,221` | Map empty/**`'User'`** names to a neutral label ("Name Not Set") in a shared formatter, applied on hires, workers, users, dashboard and reports. |
| HR-04 | Search placeholder mismatch | **Low** | Global header search reads `"Search workers, users..."` even on the Hire Requests page, and the input has **no `value`/`onChange`/handler at all** — it is a dead control. (This is the item the brief calls out.) | `AdminShell.tsx:227-237` (placeholder line 231) | Make the placeholder page-contextual (e.g. "Search requests…") and either wire the input to a real search or remove it. |
| HR-05 | `workerPerformance` returned twice | **Low** | The endpoint duplicates the same object as `worker.performance` **and** top-level `workerPerformance` "for older clients" (`admin.js:471-473`), and the client has a fallback `??` for both. Two sources of truth for identical data; drift risk. | `admin.js:455-473`; `hires/page.tsx:176` | Keep one canonical field; remove the legacy duplicate once the old client is retired. |
| HR-06 | N+1 signed-URL generation (hire list) | **Med** | Not present on hires (no signed URL there) — **but** see SD-01 for the same pattern on the workers list. Flagged here so the two list endpoints are fixed together. | `admin.js:450` (`workerPerformanceMap`) is a single batched `.in()` query — OK; contrast `admin.js:158-162` | Apply the same batching used at `admin.js:450` everywhere. |

---

## 2. DASHBOARD PAGE (Metrics & Performance)

**Files traced:** `sahikarigar-app/src/app/admin/page.tsx` · `sahikarigar-app/src/lib/api.ts:400-409` · `auth-server/src/admin.js:217-235` · `auth-server/src/index.js:809-817`

### Trace of the endpoint
1. `AdminDashboardPage.loadAll()` calls `Promise.all([getAdminStats(), listAdminWorkers('pending',1)])` (`page.tsx:140-143`).
2. `getAdminStats()` → `GET /admin/stats` (`api.ts:407-408`).
3. Server `GET /admin/stats` → `requireAdmin()` → `getAdminStats()` (`index.js:809-817`).
4. `getAdminStats()` runs **4 `count: 'exact', head: true` queries in parallel** (`admin.js:217-235`).
5. `AdminShell` also independently calls `getAdminStats()` on mount (`AdminShell.tsx:59`) → **the same 4 queries run twice per page load.**

### Findings

| Issue ID | Component/Page | Severity | Description | File:Line Reference | Recommended Fix |
|---|---|---|---|---|---|
| DB-01 | Dashboard — counts correctness | **Low** | Counts are structurally correct: `totalUsers` = all rows in `users` (both roles), `totalHires` = all `hire_requests`, `pendingVerifications` = `worker_profiles where verification_status='pending'`, `activeWorkers` = `worker_profiles where is_approved=true`. No obvious logic error. Note `activeWorkers` is **not** "revenue" and there is **no Revenue metric** at all (brief asked for it). | `admin.js:217-235` | Confirm product intent; if a Revenue/earnings card is required it must be implemented server-side. |
| DB-02 | Dashboard — "Active Workers" card duplicates Total Users on null | **Med** | The Active Workers card is labeled and badged "Live", but if `stats.activeWorkers` is `undefined`/`null` it silently renders `totalUsers` instead (`page.tsx:196-198`). That is a **misleading statistic** (workers ≠ users) shown with a green "Live" dot. | `page.tsx:194-202,319-323` | Fall back to `'--'`/`N/A`, never to an unrelated metric. |
| DB-03 | Dashboard — hardcoded fake metrics | **High** | Several dashboard elements are **fabricated** and look real to an operator: "Last updated 2 mins ago", "+12% this week", "+8% vs last week", changing sparklines (`bars` arrays), "All systems operational", "34ms" API latency, notification badge "3", and hardcoded quick-action pills (`'8 new'`). None come from the API. This destroys trust in an admin decision surface. | `page.tsx:243, 178-202, 326, 332, 340, 347-352, 320-322`; shell footer `AdminShell.tsx:257-261,244-246` | Remove or wire to real endpoints. Never ship fabricated KPIs in a production admin panel. |
| DB-04 | Dashboard — no real-time / caching strategy | **Med** | Data is fetched **once on mount** and never refreshed (no interval, no polling, no manual Refresh, no cache headers). The "Last updated 2 mins ago" and "Live updates" labels are static text, so the dashboard is stale the moment it loads. | `page.tsx:134-170` (useEffect runs once); `api.ts:407` | Add a refresh affordance and/or polling with a real timestamp; or clearly label as a snapshot. |
| DB-05 | Dashboard — duplicate stats fetch (perf) | **Low** | `AdminShell` and the dashboard page each call `GET /admin/stats` on load → the 4 count queries run **twice**. | `AdminShell.tsx:55-74` + `page.tsx:140-143` | Fetch once and share (context/store), or have the shell read counts from a single fetch. |
| DB-06 | Dashboard / Workers — potential N+1 (Aadhaar signing) | **Med** | `listAdminWorkers` (used by both the dashboard activity list and the workers page) calls `signedAadhaarUrl()` inside an `await Promise.all(map(...))` — one Supabase Storage `createSignedUrl` per worker row (up to 50). For a page of workers that is **50 sequential-ish storage round-trips per list request**, a classic N+1. | `admin.js:158-162` (calls `signedAadhaarUrl` at `admin.js:132-139`) | Batch/sign on demand, sign only the opened worker in the detail modal, or use `createSignedUrls` (plural) in a single call. The list does not need per-row Aadhaar URLs at all. |

---

## 3. WORKER VERIFICATION PAGE (Security & Actions)

**Files traced:** `sahikarigar-app/src/app/admin/workers/page.tsx` · `sahikarigar-app/src/components/admin/WorkerDetailModal.tsx` · `auth-server/src/index.js:639-807` · `auth-server/src/admin.js:142-215`

### Trace of the endpoint
1. `WorkerApprovalsPage` → `listAdminWorkers('pending', page)` → `GET /admin/workers?status=pending` (`workers/page.tsx:52`, `api.ts:362-367`).
2. Server `GET /admin/workers` → `requireAdmin()` → `listAdminWorkers()` (`index.js:748-761`).
3. Approve/Reject happen inside `WorkerDetailModal` via `setWorkerApproval(id, approved, notes)` → `PATCH /admin/workers/:id` (`WorkerDetailModal.tsx:128-146`, `api.ts:380-398`).
4. Server `PATCH /admin/workers/:id` → `requireAdmin()` → `setWorkerApproval()` (`index.js:778-807`).

### Findings

| Issue ID | Component/Page | Severity | Description | File:Line Reference | Recommended Fix |
|---|---|---|---|---|---|
| WV-01 | **`requireAdmin` middleware exists and is applied to every `/admin/*` route except login** | **Info (PASS)** | `requireAdmin()` verifies the HMAC-signed Bearer token via `getAdminSession()`, returns **401** on missing/invalid token and **503** on misconfiguration. It is invoked at the top of `/admin/workers`, `/admin/workers/:id` (GET+PATCH), `/admin/stats`, `/admin/users`, `/admin/users/:id`, `/admin/reports`, `/admin/reports/:id`, `/admin/hires`, `/admin/hires/:id`, `/admin/session`. **A normal user cannot spoof `/admin/verify-worker`** — the equivalent route is `PATCH /admin/workers/:id` and it is gated. | Definition `index.js:643-669`; usage `index.js:738-911`; token mint/verify `admin.js:39-83` | Keep. Consider centralizing as `app.use('/admin', ...)` so a future route cannot forget it. |
| WV-02 | Legacy admin routes bypass this model | **High** | The **root** app's admin page (`src/app/admin/page.tsx`) has **no admin middleware, no `middleware.ts`, and no `role === 'admin'` check anywhere** in `src/` (grep returned nothing). It gates only on `user` presence client-side (`src/app/admin/page.tsx:52-56,90-99`). If that page/route is still reachable in any deploy, any logged-in phone user reaches a worker-approval UI. | `src/app/admin/page.tsx`; no `src/middleware.ts`; `src/lib/api.ts:242-258` | Delete the legacy panel or gate it server-side. Confirm only `sahikarigar-app` is published. |
| WV-03 | **No confirmation modal before Approve / Reject** | **High** | In `WorkerDetailModal`, "Approve worker" calls `decide(true)` immediately on click (`WorkerDetailModal.tsx:432-439`) with **no confirmation step**. One accidental click permanently approves a worker. (Reject does have a reason step, which doubles as confirmation; Approve does not.) Elsewhere there is **no `window.confirm` and no confirm modal** in the entire admin app (grep for `confirm|Modal|dialog` found only `WorkerDetailModal` itself). | `WorkerDetailModal.tsx:128-146, 432-439`; `workers/page.tsx` has no confirm | Add an explicit confirm dialog ("Approve this worker? This makes them publicly visible") before the PATCH. Same for Block/suspend on the Users page. |
| WV-04 | Bulk/row action buttons have no confirmation | **Med** | The dashboard "Recent activity" rows expose an Approve (✓) button with an `aria-label` but **no handler / no confirmation** (`page.tsx:452-458`), and the Users page "Block / suspend" fires `toggleActive` on click with no confirm (`users/page.tsx:206-221`). Accidental clicks have real consequences. | `page.tsx:450-467`; `users/page.tsx:45-58,206-221` | Wire handlers + confirm dialogs, or remove non-functional buttons (WV-05). |
| WV-05 | Dead action buttons in dashboard | **Med** | The Recent-activity Approve button and the "More actions" (⋯) button have no `onClick` handler at all — clicking does nothing. Looks functional, isn't. | `page.tsx:452-465` | Remove or implement. |
| WV-06 | Aadhaar exposure in list payload | **Med** | `ADMIN_WORKER_SELECT = '*, …'` (`admin.js:128-129`) pulls `aadhaar_number`/`aadhaar_photo_path` for **every** worker in the list, and `mapAdminWorker` forwards the full `aadhaarNumber` (`admin.js:107`). The list page doesn't need it; the full Aadhaar travels over the wire for up to 100 rows per request. The UI masks it until "Show" (`WorkerDetailModal.tsx:34-46,314`), but the raw value is already in the client/network payload. | `admin.js:85-129`; consumer `api.ts:342-343` | Exclude `aadhaar_number` from the list select; expose it only via `GET /admin/workers/:id`. |
| WV-07 | Rejection reason min-length enforced both sides | **Info (PASS)** | Server rejects `approved=false` with reason < 3 chars (`admin.js:190`) and the modal blocks submit until ≥3 chars (`WorkerDetailModal.tsx:130-133,412`). Good defense-in-depth. | `admin.js:188-191`; `WorkerDetailModal.tsx:128-146` | Keep. |
| WV-08 | `PATCH /admin/workers/:id` accepts both `approved` and `isFlagged` in one call | **Low** | If both are present, flag is applied first then approval, and only the **last** result is returned (`index.js:792-803`) — the client could see a response that omits the other change. Ambiguous partial-success semantics. | `index.js:782-803` | Split into distinct endpoints or return both results explicitly. |

---

## 4. USERS PAGE (Privacy & Edge Cases)

**Files traced:** `sahikarigar-app/src/app/admin/users/page.tsx` · `sahikarigar-app/src/lib/api.ts:411-455` · `auth-server/src/admin.js:237-304, 275-321` · `auth-server/src/index.js:819-856`

### Trace
1. `AdminUsersPage` → `listAdminUsers(role, search, page)` → `GET /admin/users?role=…&page=…` (`users/page.tsx:25`, `api.ts:423-434`).
2. Server `GET /admin/users` → `requireAdmin()` → `listAdminUsers()` (`index.js:819-833`).
3. `listAdminUsers()` selects only `id, name, phone, role, avatar, is_active, is_flagged, created_at` (`admin.js:245-246`) — **no Aadhaar, no password** in the payload. ✅

### Findings

| Issue ID | Component/Page | Severity | Description | File:Line Reference | Recommended Fix |
|---|---|---|---|---|---|
| US-01 | Sensitive fields masked | **Info (PASS)** | The Users list query explicitly selects a safe column set — **no `aadhaar_number`, no password/hash** is ever returned (`admin.js:245-246`). Passwords are not stored in `users` (auth is external via SuperTokens + HMAC admin token). Aadhaar is only in the worker detail modal, masked behind a "Show" toggle. | `admin.js:245-246`; mask `WorkerDetailModal.tsx:34-39` | Keep. Additionally ensure the DB never logs the select. |
| US-02 | Same default-name garbage as hires | **High** | `listAdminUsers` returns `row.name` raw (`admin.js:257`) and the UI prints it directly (`users/page.tsx:169`). Users with the literal default `'User'` (`users.js:87`) render as "User" — indistinguishable from real data. No "Name Not Set" mapping. | `users.js:87`; `admin.js:257`; `users/page.tsx:169` | Shared name formatter (see HR-03). |
| US-03 | Empty state present | **Info (PASS)** | When `users.length === 0` the table shows "Koi {role} nahi mila." — no blank white screen. Loading and error states also handled. | `users/page.tsx:144-155` | Keep. |
| US-04 | Pagination present (server-side) | **Info (PASS)** | `listAdminUsers` uses `.range()` with `count: 'exact'` and clamps `limit` to 1–100 (`admin.js:243-270`); `AdminPagination` renders Prev/Next when `pages > 1` (`AdminPagination.tsx:17-18`). A 10,000-user dataset is **not** loaded at once. | `admin.js:243-270`; `AdminPagination.tsx`; `users/page.tsx:230-239` | Keep. Note: search + page are debounced (250ms) client-side (`users/page.tsx:22`). |
| US-05 | Page-not-found / over-range handling | **Low** | If the current `page` exceeds `pages` after a filter change, the users page **does not** reset `page` (unlike hires/workers/reports which clamp — `hires/page.tsx:87-90`, `workers/page.tsx:53-56`, `reports/page.tsx:56-59`). A stale large page number can show an empty table. | `users/page.tsx:26-31` | Add the same `if (page > max(pages,1)) setPage(...)` clamp. |
| US-06 | Search sanitization | **Info (PASS)** | The `search` term is length-capped at 100 and strips PostgREST meta-characters before `.or()` (`admin.js:250`), preventing filter injection. | `admin.js:250-251` | Keep. |
| US-07 | Role param validation | **Info (PASS)** | `role` is normalized/validated against `employer|worker|all`; anything else throws (`admin.js:238-242` → 400 via error handler). | `admin.js:237-242` | Keep. |

---

## 5. EDGE CASES & ERROR HANDLING

**Files traced:** `sahikarigar-app/src/lib/api.ts:74-110` · `AdminGuard.tsx` · `auth-server/src/index.js:921-948`

### Findings

| Issue ID | Component/Page | Severity | Description | File:Line Reference | Recommended Fix |
|---|---|---|---|---|---|
| EH-01 | 500 error handling | **Info (PASS)** | A non-2xx throws with the server message; each page catches it and renders an inline amber `role="alert"` banner (e.g. `hires/page.tsx:144-148`, `users/page.tsx:126-130`, `workers/page.tsx:125-129`). The dashboard shows a richer error card with a Retry button (`page.tsx:260-305`). **The UI does not crash** — it shows an error state, not a 500 screen. | `api.ts:106-108`; per-page error banners; `page.tsx:260-305` | Consider a shared toast component for consistency (currently inline banners differ per page). |
| EH-02 | 5xx vs 401 distinction | **Info (PASS)** | `adminApiFetch` only clears the admin token on a **genuine 401**; a 5xx/network error keeps the token so a cold Render start can't log the admin out (`api.ts:96-104`). Backend returns **503** (not 401) when `ADMIN_SESSION_SECRET` is misconfigured (`index.js:647-654`), which the client correctly treats as "keep token". Good. | `api.ts:96-104`; `index.js:643-654` | Keep. |
| EH-03 | Session expiry during "Approve" | **Med** | On expiry, the PATCH returns 401 → `adminApiFetch` clears the token and dispatches `sahikarigar-admin-unauthorized` (`api.ts:99-104`). `AdminGuard` listens and flips to the login form (`AdminGuard.tsx:97-100,107`). **However:** (a) the in-flight action's `catch` shows a raw error banner *and* the login form appears simultaneously, which is confusing; (b) there is **no redirect that preserves the admin's intent** — they must log in and re-do the approval. (c) The failure of the specific action is not clearly explained as "session expired". | `api.ts:99-104`; `AdminGuard.tsx:97-100`; `WorkerDetailModal.tsx:139-142` | On 401 during a mutation, show "Session expired — please log in again", redirect to login, and return the admin to the same worker (deep-link/re-open modal after re-auth). |
| EH-04 | Token storage | **High** | The admin session token is stored in `localStorage` (`api.ts:34,52-59,121`) under key `admin_token`, readable by any XSS on the admin origin. The token is an HMAC bearer with a 4-hour TTL (`admin.js:8`) and there is no rotation/refresh. Any script injection = full admin takeover. | `api.ts:34,52-59,121`; `admin.js:8,39-52` | Prefer a secure, HttpOnly, SameSite cookie for the admin session; if keeping localStorage, tighten CSP and add short TTL + refresh. |
| EH-05 | Admin auth model is a single shared credential | **Med** | There is exactly **one** admin identity: `ADMIN_EMAIL`/`ADMIN_PASSWORD` from env, compared with `safeEqual` (`admin.js:26-37`). No per-admin accounts, roles, or audit trail of *which* admin approved *which* worker. | `admin.js:26-52,66-83`; `index.js:675-736` | Add per-admin accounts + an append-only audit log for approve/reject/block actions. |
| EH-06 | Login brute-force protection | **Info (PASS)** | `/admin/login` rate-limits by IP: 5 failures / 15 min window, with map cleanup (`index.js:671-731`). Good. Credential compare is constant-time (`admin.js:10-14,34-35`). | `index.js:671-736`; `admin.js:10-14` | Keep. Consider Redis-backed limiter so it survives restarts / multi-instance. |
| EH-07 | Client guard is "token presence" only | **Med** | `AdminGuard` never validates the token on mount — it trusts any non-empty `admin_token` in localStorage (`AdminGuard.tsx:84-95`). A user can paste a fake token to *see the admin shell*; every real API call then fails 401. UI-level only, but it means "the panel appears to open" for a non-admin. | `AdminGuard.tsx:84-95`; `getAdminToken` `api.ts:70-72` | Optionally ping `/admin/session` once on mount to validate, while still not logging out on 5xx (see EH-02). |
| EH-08 | Error messages may leak internals | **Low** | Backend forwards raw `error.message` (including Supabase/db errors) to the client, and the dashboard even prints the raw `error` string in a monospace line (`page.tsx:293`). | `index.js:921-948`; `page.tsx:271,293` | Return sanitized user-facing messages; log the technical detail server-side only. |
| EH-09 | Legacy admin page has no error/guard robustness | **Med** | `src/app/admin/page.tsx` blocks the whole UI on `!user` without any admin role check and shows a "Pehle login karo" card to *any* signed-in-but-non-admin user, implying access control that doesn't exist. | `src/app/admin/page.tsx:52-56,90-110` | Remove legacy panel (see WV-02). |

---

## SUMMARY OF SEVERITIES

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 7 | HR-01, HR-03, DB-03, WV-02, WV-03, US-02, EH-04 |
| Medium | 12 | HR-02, HR-06, DB-02, DB-04, DB-06, WV-04, WV-05, WV-06, EH-03, EH-05, EH-07, EH-09 |
| Low | 8 | HR-04, HR-05, DB-01, DB-05, WV-08, US-05, EH-08 (and info-level passes) |
| Info (PASS) | 11 | WV-01, WV-07, US-01, US-03, US-04, US-06, US-07, EH-01, EH-02, EH-06 … |

---

## VERDICT

**Is the Admin Panel secure and ready for production? — NO.**

The **backend authorization is genuinely solid** (HMAC-signed admin tokens, `requireAdmin()` on every `/admin/*` route, constant-time credential compare, login rate-limiting, server-side pagination, parameter sanitization, and clean 401-vs-5xx handling). The panel is **not** vulnerable to the specific spoofing attack in the brief: a normal user **cannot** call `PATCH /admin/workers/:id` — it is correctly gated.

However, the panel is **not production-ready** because of data-integrity defects that would actively mislead an operator, missing destructive-action safeguards, and a high-impact token-storage weakness.

### Top 3 Blockers

1. **HR-01 / HR-03 / US-02 / DB-03 — The panel shows misleading and fabricated data (High).**
   Per-request rows display worker-*lifetime* aggregates as if they described the row (`hires/page.tsx:176,232` + `admin.js:404-474`), producing the exact `Status = Completed` / `Accepted: 0` contradiction reported; default users named literally `"User"` (`users.js:87`) are rendered verbatim across hires/users as garbage data; and the dashboard ships hardcoded fake KPIs ("+12% this week", "Last updated 2 mins ago", "34ms", sparklines). An admin cannot make correct decisions from numbers that are partly invented and partly mislabeled.

2. **WV-03 / WV-04 — No confirmation before destructive actions (High).**
   "Approve worker" fires the PATCH on a single click with no confirm dialog (`WorkerDetailModal.tsx:432-439`), and the Users page "Block / suspend" and dashboard action buttons likewise have no confirmation (`users/page.tsx:206-221`, `page.tsx:452-465`). A misclick permanently changes a user's public visibility/access with no verify step.

3. **WV-02 / EH-04 — Two admin surfaces + insecure token storage (High).**
   A second, **ungated** admin panel still exists at `src/app/admin/page.tsx` with **no `middleware.ts` and no admin-role check anywhere in `src/`** — any logged-in user could reach it if that deploy is live. And the active panel stores its full-power admin bearer token in `localStorage` (`api.ts:34,121`) with no HttpOnly cookie, no rotation, and a 4-hour TTL — one XSS equals full admin compromise.

**Recommended path to production:** remove/secure the legacy panel (WV-02) and confirm only `sahikarigar-app` is published; add confirm dialogs to all destructive actions (WV-03/04); introduce a shared name formatter mapping `"User"`/empty → "Name Not Set" (HR-03/US-02) and fix the hire status-vs-aggregate scoping (HR-01); strip fabricated dashboard metrics (DB-03); and move the admin session to an HttpOnly cookie (EH-04). Address the Aadhaar-in-list N+1 and over-exposure (DB-06/WV-06) as fast-follows.
