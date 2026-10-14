# ⚙️ SahiKaarigar - Backend Architecture

## 🎯 Backend Philosophy
- **Lightweight** - Fast response times
- **Scalable** - Handle growth easily
- **Secure** - User data protection
- **Clean Code** - Easy to maintain
- **API-First** - Frontend can change, backend stays

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────┐
│                 FRONTEND                     │
│            (Next.js + Tailwind)              │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│              API ROUTES                      │
│         (Next.js API Routes)                 │
├─────────────────────────────────────────────┤
│  /api/auth/*    - Authentication             │
│  /api/users/*   - User Management            │
│  /api/workers/* - Worker Operations          │
│  /api/hires/*   - Hire Requests              │
│  /api/reviews/* - Reviews & Ratings          │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│              SERVICES LAYER                  │
├─────────────────────────────────────────────┤
│  AuthService    - OTP, JWT tokens            │
│  UserService    - CRUD operations            │
│  WorkerService  - Search, Filter, Profile    │
│  HireService    - Request management         │
│  ReviewService  - Rating calculations        │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│            DATABASE LAYER                    │
├─────────────────────────────────────────────┤
│  MongoDB Atlas (Free Tier - 512MB)           │
│  Mongoose ODM                                │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│          EXTERNAL SERVICES                   │
├─────────────────────────────────────────────┤
│  Firebase Auth - Phone OTP                   │
│  Cloudinary   - Image Upload                 │
│  Vercel       - Hosting                      │
└─────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth pages
│   ├── (main)/            # Main pages
│   ├── api/               # API Routes
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
│
├── components/            # Reusable components
│   ├── ui/               # Button, Input, Card
│   ├── layout/           # Header, Footer, Nav
│   └── worker/           # Worker components
│
├── lib/                   # Core libraries
│   ├── db.ts             # MongoDB connection
│   ├── firebase.ts       # Firebase config
│   └── auth.ts           # Auth utilities
│
├── models/               # Mongoose models
│   ├── User.ts
│   ├── WorkerProfile.ts
│   ├── HireRequest.ts
│   └── Review.ts
│
├── services/             # Business logic
│   ├── auth.service.ts
│   ├── worker.service.ts
│   └── hire.service.ts
│
└── types/                # TypeScript types
```

---

## 🗄️ Database Models

### 1. User Model
```typescript
// models/User.ts
const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['worker', 'employer', 'admin'] },
  avatar: String,
  location: {
    area: String,
    city: { type: String, default: 'Hyderabad' },
    lat: Number,
    lng: Number
  },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false }
}, { timestamps: true });
```

### 2. WorkerProfile Model
```typescript
// models/WorkerProfile.ts
const workerProfileSchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: 'User', unique: true },
  skills: [{ type: String }],  // Electrician, Plumber, etc.
  experience: Number,
  description: String,
  hourlyRate: Number,
  availability: { type: String, enum: ['available', 'busy', 'offline'] },
  portfolio: [String],  // Cloudinary URLs
  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  completedJobs: { type: Number, default: 0 },
  serviceAreas: [String],
  isApproved: { type: Boolean, default: false }
}, { timestamps: true });
```

### 3. HireRequest Model
```typescript
// models/HireRequest.ts
const hireRequestSchema = new mongoose.Schema({
  employerId: { type: ObjectId, ref: 'User' },
  workerId: { type: ObjectId, ref: 'WorkerProfile' },
  description: String,
  location: String,
  proposedRate: Number,
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'] 
  },
  scheduledDate: Date
}, { timestamps: true });
```

### 4. Review Model
```typescript
// models/Review.ts
const reviewSchema = new mongoose.Schema({
  hireRequestId: { type: ObjectId, ref: 'HireRequest' },
  reviewerId: { type: ObjectId, ref: 'User' },
  workerId: { type: ObjectId, ref: 'WorkerProfile' },
  rating: { type: Number, min: 1, max: 5 },
  comment: String
}, { timestamps: true });
```

---

## 🔌 API Endpoints

### Authentication (/api/auth/*)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/send-otp | Send OTP to phone |
| POST | /api/auth/verify-otp | Verify OTP, return JWT |
| POST | /api/auth/register | Register new user |
| GET | /api/auth/me | Get current user |

### Workers (/api/workers/*)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/workers | Search workers (with filters) |
| GET | /api/workers/:id | Get worker profile |
| POST | /api/workers | Create worker profile |
| PUT | /api/workers/:id | Update worker profile |
| PATCH | /api/workers/:id/availability | Toggle availability |

### Hire Requests (/api/hires/*)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/hires | Create hire request |
| GET | /api/hires | Get user's hire requests |
| PATCH | /api/hires/:id/accept | Accept request |
| PATCH | /api/hires/:id/reject | Reject request |
| PATCH | /api/hires/:id/complete | Mark completed |

### Reviews (/api/reviews/*)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/reviews | Create review |
| GET | /api/reviews/:workerId | Get worker reviews |

---

## 🔐 Authentication Flow

```
1. User enters phone number
        ↓
2. Backend sends OTP via Firebase
        ↓
3. User enters OTP
        ↓
4. Backend verifies OTP with Firebase
        ↓
5. Generate JWT token
        ↓
6. Return token + user data
        ↓
7. Frontend stores token in httpOnly cookie
        ↓
8. All requests include token
        ↓
9. Backend verifies token on protected routes
```

---

## 🔍 Worker Search Query

```typescript
// services/worker.service.ts
async function searchWorkers(filters: WorkerFilters) {
  const query: any = {
    isApproved: true,
    availability: 'available'
  };

  if (filters.skills?.length > 0) {
    query.skills = { $in: filters.skills };
  }

  if (filters.area) {
    query.serviceAreas = filters.area;
  }

  if (filters.minRating) {
    query['rating.average'] = { $gte: filters.minRating };
  }

  if (filters.maxRate) {
    query.hourlyRate = { $lte: filters.maxRate };
  }

  const workers = await WorkerProfile.find(query)
    .populate('userId', 'name phone avatar location')
    .sort({ 'rating.average': -1 })
    .skip(filters.skip || 0)
    .limit(filters.limit || 20);

  return workers;
}
```

---

## 📊 Database Connection

```typescript
// lib/db.ts
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;

let cached = global.mongoose || { conn: null, promise: null };

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 10  // Small pool for lightweight
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
```

---

## 📦 Dependencies (Minimal)

```json
{
  "dependencies": {
    "next": "14.x",
    "react": "18.x",
    "mongoose": "8.x",
    "jsonwebtoken": "9.x",
    "firebase-admin": "12.x",
    "cloudinary": "2.x",
    "zod": "3.x"
  }
}
```

**Total bundle: ~150KB (gzipped)**

---

## 🚀 Performance Tips

### Database
- Proper indexes on all query fields
- Lean queries (select only needed fields)
- Connection pooling (max 10)
- Pagination for large results

### API
- Response compression
- Cache headers for static data
- Minimal JSON responses

### Images
- Cloudinary auto-optimization
- WebP format
- Lazy loading

---

## 📊 API Response Format

### Success
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error
```json
{
  "success": false,
  "error": "Error message"
}
```

### Paginated
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

---

*Backend Architecture Ready for Development*