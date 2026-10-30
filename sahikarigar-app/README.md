# 🔧 SahiKaarigar

**Hyderabad ke Best Workers Dhundho**

A mobile-first web application connecting local workers (electricians, plumbers, painters, etc.) with employers in Hyderabad, India.

**🌐 Live:** https://sahikaarigar.vercel.app
**🛠️ Admin Panel:** https://sahikaarigar.vercel.app/admin/

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

Deployed on **Vercel** (auto-deploys on every push to `main`):

| Piece | URL |
| --- | --- |
| Web app + Admin panel | https://sahikaarigar.vercel.app |
| Admin panel | https://sahikaarigar.vercel.app/admin/ |
| Auth server (Render) | https://sahikaarigar-auth.onrender.com — see `RENDER_DEPLOY.md` |

Local build check (Next.js server build — the admin session proxy in
`src/app/api/admin/[...path]/route.ts` requires a server):

```powershell
npm run build
```

> The old static Firebase Hosting deployment (`sahi-kaarigar.web.app`) has been
> retired. Do not deploy it again — Route Handlers (`src/app/api/**/route.ts`)
> cannot be deployed as static files, and the admin proxy requires them.

## 🔧 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/verify` | Verify Firebase token |
| GET | `/api/workers` | Search workers |
| POST | `supabase/functions/auth` | Login + registration (Supabase Edge Function) |
| ALL | `/api/admin/…` | Same-origin proxy for the admin panel session (first-party cookie) |

> The Vercel deployment runs in server mode, so these routes are live.
> Setting `output: 'export'` (the old Firebase static approach) silently
> removes them.

## 🎨 Design System

- **Primary**: `#15803D` (green, WCAG 4.5:1 compliant) · brand `#16A34A` · light `#22C55E`
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