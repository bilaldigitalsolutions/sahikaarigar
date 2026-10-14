# 🎨 SahiKaarigar - UI/UX Design System

## 🎯 Design Philosophy
- **Lightweight** - Fast loading, minimal resources
- **Mobile-First** - Phone pe best experience
- **Simple** - Kam clicks, zyada kaam
- **Desi Feel** - Hyderabad ke local users ke liye
- **Trustworthy** - Clean, professional look

---

## 🎨 Color Palette (WCAG Compliant)

### Primary Colors
| Color | Hex | Use | Contrast |
|-------|-----|-----|----------|
| Primary | #FF6B35 | Icons, badges, backgrounds | 2.8:1 (decorative only) |
| Primary Dark | #D84315 | **Buttons, CTAs, text on white** | 4.5:1 ✅ |
| Primary Light | #FF8F66 | Backgrounds, badges | Decorative |

### ⚠️ Important: Button/Text Color Rules
- **White text on button:** Use `#D84315` background (not #FF6B35)
- **Orange text on white:** Use `#D84315` (not #FF6B35)
- **#FF6B35** sirf decorative elements (icons, badges, backgrounds) ke liye

### Neutral Colors
| Color | Hex | Use |
|-------|-----|-----|
| Background | #FAFAFA | Page background |
| Card | #FFFFFF | Cards, modals |
| Text Primary | #1A1A1A | Headings |
| Text Secondary | #666666 | Subtitles |
| Success | #28A745 | Available |
| Danger | #DC3545 | Errors |

---

## 📱 Typography (Worker-Friendly)

### Font: Inter (Google Fonts - Free, fast)
### Hindi/Telugu: Noto Sans Devanagari

| Element | Size | Weight | Note |
|---------|------|--------|------|
| H1 (Hero) | 28px | Bold (700) | |
| H2 (Section) | 24px | Semi-Bold (600) | |
| H3 (Card Title) | 20px | Semi-Bold (600) | |
| **Body** | **18px** | Regular (400) | **Worker-friendly** |
| Small | 16px | Regular (400) | |
| Caption | 14px | Regular (400) | |

### ⚠️ Important: Body Font Size
- **16px** bahut chhota hai workers ke liye (especially outdoor use)
- **18px minimum** rakho body text ke liye
- Workers phone dhoop mein use karte hain, bada text = easy reading

---

## 🔘 Buttons

### Primary Button
```
Background: #FF6B35
Text: White
Padding: 14px 28px
Border Radius: 12px
Font: 16px Semi-Bold
Shadow: 0 4px 12px rgba(255, 107, 53, 0.3)
```

### Secondary Button
```
Background: Transparent
Border: 2px solid #FF6B35
Text: #FF6B35
Padding: 12px 26px
Border Radius: 12px
```

---

## 📦 Cards

### Worker Card
```
Background: White
Border Radius: 16px
Padding: 16px
Shadow: 0 2px 8px rgba(0,0,0,0.08)

Layout:
┌─────────────────────────────────┐
│ [Photo]  Name                   │
│          Skills: ⚡ 🔧 🎨       │
│          ⭐ 4.5 (23 reviews)    │
│          📍 Ameerpet            │
│          ₹300/hr                │
│          [Available] [Hire]     │
└─────────────────────────────────┘
```

---

## 📝 Forms

### Input Fields
```
Background: #F5F5F5
Border: 2px solid transparent
Border Radius: 12px
Padding: 14px 16px
Font: 16px
Focus: Border #FF6B35
Error: Border #DC3545
```

---

## 🧭 Navigation

### Bottom Navigation (Mobile)
```
Height: 64px
Background: White
Shadow: 0 -2px 10px rgba(0,0,0,0.05)

Tabs:
┌─────────────────────────────────────┐
│  🏠     🔍     ➕     📋     👤    │
│ Home  Search  Hire  Requests Profile│
└─────────────────────────────────────┘
```

---

## 📄 Key Screens

### 1. Landing Page (/)
```
┌─────────────────────────────────┐
│ [Logo]                    [☰]  │
├─────────────────────────────────┤
│ Hyderabad ke Best               │
│ Workers Dhundho 🔍              │
│                                 │
│ [Search by Skill...        ]    │
│ [Select Area...            ]    │
│ [ SEARCH WORKERS         ]     │
├─────────────────────────────────┤
│ Popular Categories              │
│ [⚡Electric] [🔧Plumb] [🎨Paint]│
├─────────────────────────────────┤
│ How It Works                    │
│ 1️⃣ Search → 2️⃣ View → 3️⃣ Hire │
├─────────────────────────────────┤
│ [Register as Worker]            │
│ [Hire a Worker]                 │
└─────────────────────────────────┘
```

### 2. Search Page (/search)
```
┌─────────────────────────────────┐
│ [←] Search Workers        [🔧] │
├─────────────────────────────────┤
│ [Skill ▼] [Area ▼] [Rating ▼]  │
├─────────────────────────────────┤
│ 45 Workers Found                │
├─────────────────────────────────┤
│ [Worker Card 1]                 │
│ [Worker Card 2]                 │
│ [Worker Card 3]                 │
│ [Load More...]                  │
└─────────────────────────────────┘
```

### 3. Worker Profile (/worker/[id])
```
┌─────────────────────────────────┐
│ [←] Worker Profile              │
├─────────────────────────────────┤
│      [Large Photo]              │
│      Raj Kumar                  │
│      ⭐ 4.8 (45 reviews)       │
│      📍 Ameerpet               │
├─────────────────────────────────┤
│ Skills: [⚡Electric] [🔧Wire]  │
│ Experience: 5 years             │
│ Rate: ₹300/hour                 │
│ Status: ✅ Available            │
├─────────────────────────────────┤
│ Portfolio: [📷] [📷] [📷]      │
├─────────────────────────────────┤
│ Reviews (45)                    │
│ ⭐⭐⭐⭐⭐ "Bahut accha kaam"  │
├─────────────────────────────────┤
│ [📞 Call] [💬 WhatsApp] [HIRE] │
└─────────────────────────────────┘
```

### 4. Worker Registration (/register/worker)
```
Step 1 of 4 ●○○○
┌─────────────────────────────────┐
│ Phone Number                    │
│ [+91 XXXXXXXXXX           ]     │
│ [ Send OTP                ]     │
│ OTP                             │
│ [_ _ _ _ _ _               ]    │
│ Full Name                       │
│ [___________________________]   │
│ [ Next →                  ]     │
└─────────────────────────────────┘
```

### 5. Dashboard (/dashboard)
```
Worker View:
┌─────────────────────────────────┐
│ Welcome, Raj! 👋          [🔔] │
├─────────────────────────────────┤
│ Hires: 23 | Rating: 4.8 | ₹12K│
├─────────────────────────────────┤
│ Pending Requests (3)            │
│ [Request] [Accept] [Reject]     │
├─────────────────────────────────┤
│ Recent Reviews                  │
│ ⭐⭐⭐⭐⭐ "Accha kaam"        │
└─────────────────────────────────┘
```

---

## ✨ Animations (Lightweight)

- **Page Transition:** Fade (200ms)
- **Card Hover:** Scale 1.02 (150ms)
- **Button Click:** Scale 0.98 (100ms)
- **Loading:** Skeleton screens
- **Toast:** Slide from top (300ms)

### Avoid
- ❌ No complex parallax
- ❌ No heavy effects
- ❌ No video backgrounds

---

## 📱 PWA Setup

### Manifest
```json
{
  "name": "SahiKaarigar",
  "short_name": "SahiKaarigar",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FAFAFA",
  "theme_color": "#FF6B35"
}
```

### Features
- Install as app on phone
- Offline basic pages
- Push notifications
- Fast loading (cached)

---

## 🎯 Best Practices

1. **Fast Loading** - Skeleton screens, lazy load images
2. **Easy Navigation** - Max 3 taps to any feature
3. **Clear CTAs** - One primary action per screen
4. **Trust Building** - Verified badges, real photos
5. **Error Handling** - Friendly messages in Hindi/English

---

## 📊 Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Bundle Size | < 200KB |
| Lighthouse Score | 90+ |

---

*Design System Ready for Development*