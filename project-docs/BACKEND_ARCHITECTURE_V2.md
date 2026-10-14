# ⚙️ SahiKaarigar - Backend Architecture V2 (Fixed)

## 🔧 Changes from V1
- ✅ Auth: Firebase Only (NextAuth removed)
- ✅ Search: MongoDB 2dsphere + case-insensitive
- ✅ Security: Zod validation + Rate limiting
- ✅ Indexes: Proper compound indexes
- ✅ Trust: Report/Block collection added
- ✅ Privacy: Phone hidden until hire accepted

---

## 🎯 Backend Philosophy
- **Lightweight** - Fast response times
- **Secure** - Zod validation + Rate limiting
- **Privacy-First** - Phone numbers protected
- **Search-Optimized** - 2dsphere indexes

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
│  /api/auth/*    - Firebase Auth              │
│  /api/workers/* - Worker Operations          │
│  /api/hires/*   - Hire Requests              │
│  /api/reviews/* - Reviews                    │
│  /api/admin/*   - Admin Panel                │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│              MIDDLEWARE                       │
├─────────────────────────────────────────────┤
│  Auth Middleware - Firebase verifyIdToken    │
│  Rate Limiting  - Upstash Redis (Free)      │
│  Zod Validation - Input sanitization        │
│  Error Handler  - Centralized errors        │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│              SERVICES LAYER                  │
├─────────────────────────────────────────────┤
│  AuthService    - Firebase token verify     │
│  WorkerService  - Search, Filter, Profile   │
│  HireService    - Request management        │
│  ReviewService  - Rating calculations       │
│  AdminService   - Approval, Reports         │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│            DATABASE (MongoDB Atlas)          │
│  Collections: users, workerProfiles,        │
│  hireRequests, reviews, reports             │
└─────────────────────────────────────────────┘
```

---

## 🔐 Authentication Flow (FIXED - Firebase Only)

```
1. Frontend: Firebase SDK → signInWithPhoneNumber()
        ↓
2. User receives OTP on phone
        ↓
3. Frontend: user.getIdToken() → sends to backend
        ↓
4. Backend: firebaseAdmin.auth().verifyIdToken(token)
        ↓
5. If valid:
   - Check if user exists in MongoDB
   - If not, create new user
   - Return user data (NO JWT needed)
        ↓
6. Frontend stores token in httpOnly cookie
        ↓
7. All requests include Firebase token
        ↓
8. Backend verifies token on every request
```

### Why Firebase Only?
- ❌ NextAuth doesn't support phone OTP properly
- ❌ JWT + Firebase = double auth = confusion
- ✅ Firebase handles OTP, verification, everything
- ✅ One token system = simple, secure

---

## 🗄️ Database Models (FIXED)

### 1. User Model
```typescript
// models/User.ts
const userSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  phone: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['worker', 'employer', 'admin'],
    default: 'employer'
  },
  avatar: String,
  location: {
    area: { type: String, trim: true },
    city: { type: String, default: 'Hyderabad' },
    coordinates: {
      type: { type: String, default: 'Point' },
      coordinates: [Number]  // [lng, lat]
    }
  },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  // Employer specific
  address: String,
  trustScore: { type: Number, default: 0 }
}, { timestamps: true });

// Indexes
userSchema.index({ firebaseUid: 1 });
userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ 'location.coordinates': '2dsphere' });
```

### 2. WorkerProfile Model (FIXED - with 2dsphere)
```typescript
// models/WorkerProfile.ts
const workerProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  skills: [{
    type: String,
    enum: [
      'Electrician', 'Plumber', 'Painter', 'Carpenter',
      'AC Repair', 'Cleaning', 'Driver', 'Mason',
      'Welder', 'Mechanic', 'Gardener', 'Cook'
    ]
  }],
  experience: { type: Number, min: 0, max: 50 },
  description: { type: String, maxlength: 500 },
  hourlyRate: { type: Number, min: 0 },
  availability: {
    type: String,
    enum: ['available', 'busy', 'offline'],
    default: 'available'
  },
  portfolio: [String],  // Cloudinary URLs
  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  completedJobs: { type: Number, default: 0 },
  serviceAreas: [{
    type: String,
    trim: true,
    lowercase: true  // FIX: Case-insensitive
  }],
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number]  // [lng, lat] - FIX: For 2dsphere
  },
  isApproved: { type: Boolean, default: false },
  adminNotes: String
}, { timestamps: true });

// FIX: Proper indexes for search
workerProfileSchema.index({ location: '2dsphere' });  // Geo search
workerProfileSchema.index({ skills: 1, isApproved: 1, availability: 1 });  // Compound
workerProfileSchema.index({ serviceAreas: 1, isApproved: 1 });
workerProfileSchema.index({ 'rating.average': -1 });
workerProfileSchema.index({ isApproved: 1, availability: 1 });
```

### 3. HireRequest Model
```typescript
// models/HireRequest.ts
const hireRequestSchema = new mongoose.Schema({
  employerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkerProfile',
    required: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  location: {
    type: String,
    required: true
  },
  proposedRate: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'],
    default: 'pending'
  },
  scheduledDate: Date,
  completedAt: Date,
  // Privacy: Phone visible after acceptance
  phoneRevealed: { type: Boolean, default: false }
}, { timestamps: true });

// Indexes
hireRequestSchema.index({ employerId: 1, status: 1 });
hireRequestSchema.index({ workerId: 1, status: 1 });
hireRequestSchema.index({ status: 1, createdAt: -1 });
```

### 4. Review Model
```typescript
// models/Review.ts
const reviewSchema = new mongoose.Schema({
  hireRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HireRequest',
    required: true
  },
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkerProfile',
    required: true
  },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, maxlength: 500 }
}, { timestamps: true });

reviewSchema.index({ workerId: 1, createdAt: -1 });
```

### 5. Report Model (NEW - Trust & Safety)
```typescript
// models/Report.ts
const reportSchema = new mongoose.Schema({
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    enum: ['fake_profile', 'bad_behavior', 'spam', 'harassment', 'other'],
    required: true
  },
  description: String,
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved'],
    default: 'pending'
  },
  adminNotes: String
}, { timestamps: true });

reportSchema.index({ reportedUserId: 1, status: 1 });
```

---

## 🔍 Worker Search Query (FIXED)

```typescript
// services/worker.service.ts

async function searchWorkers(filters: WorkerFilters) {
  const query: any = {
    isApproved: true,
    availability: 'available'
  };

  // FIX: Skill filter (case-insensitive + index-friendly)
  if (filters.skills?.length > 0) {
    query.skills = { 
      $in: filters.skills.map(s => s.toLowerCase()) 
    };
  }

  // FIX: Area filter (case-insensitive + array match)
  if (filters.area) {
    query.serviceAreas = { 
      $in: [filters.area.toLowerCase()] 
    };
  }

  // FIX: Geo search (if coordinates provided)
  if (filters.lat && filters.lng && filters.maxDistance) {
    query.location = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [filters.lng, filters.lat]
        },
        $maxDistance: filters.maxDistance * 1000  // km to meters
      }
    };
  }

  const workers = await WorkerProfile.find(query)
    .populate('userId', 'name avatar location')  // FIX: Phone not included
    .sort({ 'rating.average': -1, completedJobs: -1 })
    .skip(filters.skip || 0)
    .limit(filters.limit || 20)
    .lean();  // FIX: Lean query for performance

  return workers;
}
```

---

## 🛡️ Security Middleware

### 1. Firebase Auth Middleware
```typescript
// lib/middleware.ts
import { adminAuth } from './firebase-admin';

export async function verifyAuth(request: NextRequest) {
  const token = request.cookies.get('firebaseToken')?.value;

  if (!token) {
    return { error: 'Unauthorized', status: 401 };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    return { user: decodedToken };
  } catch (error) {
    return { error: 'Invalid token', status: 401 };
  }
}
```

### 2. Rate Limiting (Upstash Redis Free)
```typescript
// lib/rateLimit.ts
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

export async function rateLimit(
  identifier: string, 
  limit: number = 10, 
  window: number = 60
) {
  const key = `rate_limit:${identifier}`;
  const current = await redis.incr(key);
  
  if (current === 1) {
    await redis.expire(key, window);
  }
  
  if (current > limit) {
    return { success: false, remaining: 0 };
  }
  
  return { success: true, remaining: limit - current };
}
```

### 3. Zod Validation Schemas
```typescript
// lib/validations.ts
import { z } from 'zod';

export const workerSearchSchema = z.object({
  skills: z.array(z.string()).optional(),
  area: z.string().optional(),
  minRating: z.number().min(1).max(5).optional(),
  maxRate: z.number().positive().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  maxDistance: z.number().positive().optional(),
  page: z.number().positive().default(1),
  limit: z.number().positive().max(50).default(20)
});

export const hireRequestSchema = z.object({
  workerId: z.string().min(1),
  description: z.string().min(10).max(1000),
  location: z.string().min(3).max(200),
  proposedRate: z.number().positive(),
  scheduledDate: z.string().optional()
});
```

---

## 📦 Dependencies (Minimal + Secure)

```json
{
  "dependencies": {
    "next": "14.x",
    "react": "18.x",
    "mongoose": "8.x",
    "firebase-admin": "12.x",
    "zod": "3.x",
    "@upstash/redis": "1.x"
  }
}
```

**Removed:**
- ❌ `jsonwebtoken` - Firebase handles it
- ❌ `nextauth` - Firebase handles auth
- ❌ `cloudinary` - Use Firebase Storage

**Total bundle: ~120KB (gzipped)**

---

## 🔧 Environment Variables

```env
# Firebase Admin
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...

# MongoDB
MONGODB_URI=mongodb+srv://...

# Upstash Redis (Rate Limiting)
UPSTASH_REDIS_URL=...
UPSTASH_REDIS_TOKEN=...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

*Backend Architecture V2 Ready for Development*