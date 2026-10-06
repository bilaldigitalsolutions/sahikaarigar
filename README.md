# 🔧 SahiKaarigar

**Hyderabad ke Best Workers Dhundho**

A mobile-first web application connecting local workers (electricians, plumbers, painters, etc.) with employers in Hyderabad, India.

**🌐 Live:** https://sahi-kaarigar.web.app

## 🚀 Features

- **Worker Registration** - Workers can register with their skills, experience, and service areas
- **Smart Search** - Search workers by skill, area, rating, and availability
- **One-Click Hire** - Employers can hire workers with a single click
- **Phone Privacy** - Worker phone numbers are hidden until hire is accepted
- **Admin Approval** - All worker profiles are reviewed and approved by admin
- **Reviews & Ratings** - Employers can rate and review workers after job completion
- **PWA Support** - Install as a mobile app for quick access

## 🛠️ Tech Stack

### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS

### Backend
- Next.js API Routes
- Supabase (PostgreSQL + Storage)
- Firebase Auth (Phone OTP)
- Upstash Redis (Rate Limiting)

### Testing
- Jest
- React Testing Library

## 📁 Project Structure

```
src/
├── app/              # Next.js App Router
├── components/       # React components
├── lib/              # Core libraries (Supabase clients, mappers, helpers)
├── services/         # Business logic (Supabase queries)
├── types/            # TypeScript types
├── utils/            # Utility functions
└── constants/        # Constants

supabase/
└── migrations/       # SQL schema + RLS policies (run in Supabase)
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project (PostgreSQL) - see `SUPABASE_SETUP.md`
- Firebase project with Phone Auth enabled

### Installation

1. **Clone & Install**
   ```bash
   git clone https://github.com/yourusername/sahikarigar.git
   cd sahikarigar
   npm install
   ```

2. **Setup Environment**
   ```bash
   cp .env.example .env.local
   # Fill in your Supabase + Firebase credentials (and optionally Upstash Redis)
   ```
   
3. **Setup the Database**
   Run `supabase/migrations/0001_init_schema.sql` and then
   `supabase/migrations/0002_storage.sql` in the Supabase SQL Editor.
   Full instructions are in `SUPABASE_SETUP.md`.

4. **Run Development Server**
   ```bash
   npm run dev
   ```

5. **Open Browser**
   ```
   http://localhost:3000
   ```

## 🧪 Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

## 📦 Deploy

Live on Firebase Hosting (free Spark plan) as a **static site**:

```powershell
npm run deploy        # static build (out/) + firebase deploy --only hosting
```

Full details: **`FIREBASE_DEPLOY.md`**

Other builds:

```powershell
npm run build:static  # static site -> out/   (Firebase Hosting, free)
npm run build         # server build -> .next (Vercel / Cloud Run, needs a server)
```

## 🔧 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/verify` | Verify Firebase token (server mode only) |
| GET | `/api/workers` | Search workers (server mode only) |
| POST | `supabase/functions/auth` | **Login + registration (used by the live site)** |

> The live site is static on Firebase Hosting, so it uses the Supabase Edge
> Function for auth instead of the Next.js API routes. See `FIREBASE_DEPLOY.md`.

## 🎨 Design System

- **Primary**: `#D84315` (WCAG 4.5:1 compliant)
- **Body Font**: 18px (worker-friendly)
- **Mobile-First**: Responsive, touch-friendly

## 🔒 Security

- Firebase Authentication
- Rate limiting (Upstash Redis)
- Input validation (Zod)
- Phone number privacy
- Admin approval system

## 📄 License

MIT License

---

Made with ❤️ in Hyderabad, India