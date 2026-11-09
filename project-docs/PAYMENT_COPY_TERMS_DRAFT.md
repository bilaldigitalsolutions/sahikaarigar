# SahiKaarigar — Payment Copy Alignment Draft

This document contains the updated payment-related copy for **Terms & Conditions** and **store listings** (Google Play / Indus App Store). The mobile FAQ (`sahikarigar-mobile/src/app/help/faq.tsx`) has already been updated in code.

---

## 1. Terms & Conditions — Payment Section (New / Replacement)

> **6. Payment Model**
>
> 6.1 All payments for services booked through SahiKaarigar are made **directly between the Customer and the Worker**, in cash or via UPI, at the time of service completion.
>
> 6.2 SahiKaarigar does **not** process, collect, hold, or disburse any payment. There is **no in-app payment gateway, no escrow, no wallet, and no payout facility**.
>
> 6.3 The **platform fee is ₹0 (zero rupees)**. SahiKaarigar charges no commission, service fee, or transaction fee on any hire.
>
> 6.4 Customers pay the Worker's agreed hourly rate (or agreed lump sum) directly to the Worker. SahiKaarigar is not a party to the payment and is not responsible for any payment disputes between Customer and Worker.
>
> 6.5 Workers are solely responsible for declaring and paying any taxes applicable to their earnings. SahiKaarigar does not withhold tax or issue tax documents.

---

## 2. FAQ Copy — Already Updated in Code

**Employer FAQ — "SahiKaarigar kaise kaam karta hai?"**
> App par apni requirement post karo — nearby verified workers milegi. Profile dekho, hire karo, aur kaam complete hone par worker ko direct cash ya UPI se payment karein.

**Employer FAQ — "Payment kaise karni hai?"**
> Payment direct hoti hai — worker ko kaam complete hone par cash ya UPI se payment karein. SahiKaarigar app mein koi in-app payment, escrow, ya wallet nahi hai. Platform fee ₹0 hai — koi commission nahi kाटा जाता.

**Worker FAQ — "Mujhe paise kaise milenge?"**
> Kaam complete hone ke baad client aapko direct cash ya UPI se payment karta hai. SahiKaarigar ka koi commission, wallet, ya payout system nahi hai. Platform fee ₹0 hai — aapko poora amount milta hai.

---

## 3. Store Listing Copy (Google Play & Indus App Store)

### Short Description (80 chars)
> Direct hire local verified workers. Cash/UPI payment. Zero platform fee.

### Full Description — Payment Section
**How payment works**
SahiKaarigar connects you directly with verified local workers. Payment is made directly to the worker in cash or via UPI after the work is completed. There is no in-app payment, escrow, wallet, or payout system. Platform fee is ₹0 — no commission is charged.

---

## 4. Copy Removed / Replaced

| Location | Old Claim | New Claim |
|---|---|---|
| FAQ Employer Q1 | "in-app payment karo" | "direct cash ya UPI se payment karein" |
| FAQ Employer Q3 | "UPI, card ya wallet se. Paise…release hote hai" | "direct hoti hai — cash ya UPI se. Koi in-app payment, escrow, ya wallet nahi. Platform fee ₹0." |
| FAQ Worker Q2 | "Platform commission kaat kar…wallet/bank mein aata hai" | "Direct cash ya UPI se. Koi commission, wallet, ya payout nahi. Platform fee ₹0." |

---

## 5. Verification Checklist

- [ ] FAQ code updated (`sahikarigar-mobile/src/app/help/faq.tsx`)
- [ ] Terms & Conditions page updated with Section 6 (payment model)
- [ ] Google Play Store listing updated (description + screenshots)
- [ ] Indus App Store listing updated (description + screenshots)
- [ ] No remaining references to "commission", "wallet", "escrow", "payout", or "in-app payment" in customer-facing copy
