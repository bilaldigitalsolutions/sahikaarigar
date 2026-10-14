# SahiKaarigar — Project Concept & Progress Report

> **Last updated:** October 2026
> **Author:** Bilal Digital Solutions
> **Overall Status:** 🟢 Core MVP bana hua hai (Web + Mobile), launch se pehle kuch pending kaam baaki hain.

---

## 1. 🎯 Project Concept (Idea)

**SahiKaarigar** Hyderabad ke local skilled workers — jaise **electrician, plumber, painter, carpenter, AC repair, cleaning** — ko un employers se jodta hai jinko turant kaam karne wala banda chahiye hota hai.

### Problem
- Local kaam karne wale workers (kaarigar) ko customers tak pahunchne ka koi aasaan zariya nahi. Woh labour chowk pe baith kar middleman (contractor/dalal) par depend karte hain, jo unka kaafi hissa kat-ta hai.
- Employers ko bharosa-mand kaarigar dhundhna mushkil hota hai — koi verified profile, rating, ya booking system nahi hoti.

### Solution
Ek **mobile-first platform** jahan:
1. **Worker** apna skill, experience, area aur photo ke saath profile banaye.
2. **Employer** skill/area/rating se search kare aur ek click mein **hire request** bheje.
3. **Phone number privacy** — worker ka number tab tak hidden rehta hai jab tak hire accept na ho.
4. **Admin** har worker profile ko verify/approve kare — quality control.
5. Job ke baad employer **rating + review** de — trust system.

### Business Model (future monetization)
- Commission per successful hire.
- Featured/priority worker listings.
- Subscription for regular workers.

---

## 2. 🏗️ Architecture (2 parts)

Project do hisson mein banta hai jo **ek hi shared backend** use karte hain:

| Part | Kya hai | Tech | Status |
|------|---------|------|--------|
| **`sahikarigar-app/`** | Web app + Backend server (`auth-server/`) | Next.js 14, Express, Supabase | 🟢 Working |
| **`sahikarigar-mobile/`** | Android app (React Native) | Expo SDK 57, React Native 0.86 | 🟢 Working |

### Backend (`auth-server/`) — asli engine
- **Express** server jo dono (web + mobile) ko REST API deta hai.
- **Auth:** SuperTokens passwordless phone OTP.
- **Database:** Supabase (PostgreSQL) — tables: `users`, `worker_profiles`, `hire_requests`, `reviews`.
- **Push notifications:** Expo Push API (`src/push.js`).
- **Deploy:** Render (`https://sahikaarigar-auth.onrender.com`).

### Web app (`sahikarigar-app/`)
- Next.js 14 (App Router), TypeScript, Tailwind CSS.
- **Live on:** Firebase Hosting → https://sahi-kaarigar.web.app (static site).
- SEO: dynamic `sitemap`, area/skill pages, programmatic stats.

---

## 3. ✅ Kya-Kya Complete Hua (Done)

### 🔐 Authentication (SuperTokens phone OTP)
- [x] Phone number se passwordless login (OTP).
- [x] OTP verify karke session creation.
- [x] Session ko har API call ke saath automatically attach (web + mobile).
- [x] Naye user ka `users` row pehli sign-in par auto-create.
- [x] **Delete account** endpoint (`DELETE /account`) — Google Play policy ke liye zaroori.

### 👷 Worker side
- [x] Worker registration (skills, experience, area, photo, expected rate).
- [x] Worker profile page (reviews ke saath).
- [x] Worker dashboard — incoming hire requests, availability toggle.
- [x] Worker ko search results mein dikhana (phone hidden).
- [x] Admin approval se pehle worker "pending" rehta hai.

### 🧑‍💼 Employer side
- [x] Employer registration.
- [x] Smart search — skill + area + rating + availability filter.
- [x] Worker detail dekho.
- [x] Hire request bhejo (rate + note ke saath).
- [x] "My Hires" list — status ke saath.
- [x] Hire detail — customer actions (cancel / complete / feedback).

### 📋 Hire lifecycle (poora flow)
- [x] Hire create karo → `pending`.
- [x] Worker **accept / reject** kar sake.
- [x] Worker **on the way / arrived** mark kare (live GPS attach hota hai).
- [x] Worker/customer **complete** kare.
- [x] Customer **cancel** kare.
- [x] Status change par **push notification** dono taraf.
- [x] **Mobile worker-side actions** (accept/reject/on the way/arrived/complete) — perspective-aware screen.

### ⭐ Reviews & Ratings
- [x] Job complete hone ke baad employer review de.
- [x] Worker ki average rating calculate + display.
- [x] Platform feedback endpoint (`/feedback`).

### 🔒 Security
- [x] Rate limiting (Upstash Redis).
- [x] Input validation (Zod).
- [x] Phone number privacy (hire accept hone tak hidden).
- [x] Admin-only routes (`requireAdmin` guard).

### 📱 Mobile app screens (Expo)
- [x] Splash/loading screen + permissions (location + notification).
- [x] Login (phone OTP) + Verify.
- [x] Home (categories + recent kaarigar).
- [x] Search screen.
- [x] Worker detail.
- [x] Hire create + Hire detail (customer + worker perspectives).
- [x] Hire feedback.
- [x] My Hires (tabs) + Jobs.
- [x] Profile + Edit profile.
- [x] Register worker.
- [x] Map (Mappls / geocoder fallback).
- [x] Availability switch (worker mode).
- [x] **Autofill bug fix** — phone number rate field mein inject nahi hoga.

### 🌐 Web app pages
- [x] Home (HeroSearch + registration CTA).
- [x] Search page.
- [x] Worker profile (`/worker`).
- [x] Register (worker + employer).
- [x] Dashboard, Hires, Review, Profile.
- [x] Admin panel (worker approvals, users, reports).
- [x] Static pages — About, Contact, Privacy, Terms, Login.
- [x] SEO pages — `/skills/[skill]`, dynamic sitemap.

### 🚀 Deployment / DevOps
- [x] Web static build + Firebase Hosting deploy (LIVE).
- [x] Backend deploy setup (Render).
- [x] EAS APK build working (naye fixes build hone ke baad live honge).


---

## 4. ⏳ Kya Pending Hai (To-Do)

### 🔴 High priority (launch se pehle zaroori)
- [ ] **Real SMS provider** — abhi OTP `console` mode mein aa sakta hai (dev). Production ke liye MSG91/Twilio/Fast2SMS integrate karna hai (SahiKaarigar me OTP par bharosa).
- [ ] **Backend production deploy verify** — auth-server Render par chalu hai ya nahi, aur mobile ka `API_URL` ussi live server par point kar raha hai ya nahi confirm karna. (Warna app demo/offline mode mein chalega.)
- [ ] **Naya APK build + test** — recent fixes (worker-side actions, autofill, app name, loading screen) sirf build hone ke baad live honge.
- [ ] **Real workers onboarding** — abhi tak sirf test/demo accounts hain. Ameerpet/Kukatpally ke real 20+ workers chahiye launch ke liye.

### 🟡 Medium priority
- [ ] **Play Store launch** — EAS AAB upload karna, store listing, screenshots, privacy policy final.
- [ ] **Mappls / Places API keys** — `.env` mein optional; abhi keyless geocoder fallback chal raha hai.
- [ ] **Payment / commission** — business model ke hisaab se (future).
- [ ] **Chat / in-app messaging** — abhi sirf phone reveal + call hai; WhatsApp integration consider karna.
- [ ] **Worker verification badge** — Aadhaar/ID based KYC for trust.

### 🟢 Low priority / polish
- [ ] Glassmorphism aur heavy animations (V2 — low-end phones par performance ke liye abhi avoid).
- [ ] Role-based bottom nav (worker vs employer ke hisaab se alag tabs).
- [ ] Admin reports/analytics dashboard enhance karna.
- [ ] Multi-city expansion (abhi sirf Hyderabad focus).

---

## 5. 📊 Progress Summary (percentage estimate)

| Area | Progress |
|------|----------|
| Authentication (phone OTP) | 🟢 90% (SMS provider baaki) |
| Worker flow (register → approve → profile) | 🟢 85% |
| Employer flow (search → hire) | 🟢 90% |
| Hire lifecycle + worker actions | 🟢 85% |
| Reviews & ratings | 🟢 80% |
| Mobile app (screens) | 🟢 85% |
| Web app (pages + SEO) | 🟢 85% |
| Security (rate limit, validation, privacy) | 🟢 80% |
| Deployment (web live / backend / APK) | 🟡 65% |
| Real-world readiness (SMS, real workers, Play Store) | 🔴 40% |

> **Overall:** Core product ~80% bana hua hai. Launch ke liye asli blocker — **real SMS provider**, **backend live confirm**, aur **real workers onboarding**.

---

## 6. 🗺️ Roadmap — Aage Kya Karna Hai

1. **Step 1:** SMS provider integrate karo (production OTP).
2. **Step 2:** Backend Render par live confirm + mobile `API_URL` point karo.
3. **Step 3:** Naya APK build + real device par test.
4. **Step 4:** 20 real workers onboard karo (Ameerpet se start).
5. **Step 5:** Google Play Store par publish.
6. **Step 6:** Feedback loop + iterate (Phase 2 features).

---

*Yeh report code aur docs (README, FINAL-REVIEW-V3, auth-server routes, app/mobile screens) ke actual review par based hai — koi assumption nahi.*

