# SahiKaarigar — Dummy Test Accounts

Dono accounts **asli production API** (`sahikaarigar-auth.onrender.com`) pe bane hue hain —
normal passwordless phone-OTP login se chalenge. SMS provider abhi `console` hai,
isliye app khud **"Development OTP"** box dikhayega with **Tap to autofill**.

## 1. Customer (employer)
- Phone : **9999900002**  (app mein `+91 9999900002`)
- Naam  : Test Customer
- Area  : Mehdipatnam, Hyderabad
- Role  : employer

## 2. Kaarigar (worker) — approved ✅
- Phone : **9999900003**  (app mein `+91 9999900003`)
- Naam  : Ramesh Kumar
- Area  : Tolichowki, Hyderabad
- Skills: plumbing, electrical
- Rate  : ₹300/hr
- Status: `is_approved = true` → ab public search mein dikhta hai ✅

## Test flow
1. **Customer** (9999900002) se login → Home → search/worker → **Ramesh Kumar** dikhega → **Hire**
2. **Kaarigar** (9999900003) se login → My Work → Customer⇄Kaarigar switch → booking accept + Live Tracking
3. Payment label "per hour" + "pay after service" verify karo

> Note: kaarigar ke liye `register-worker` chala ke profile banayi + admin-style approve kiya
> (Supabase service-role se, kyunki admin UI abhi nahi hai).
