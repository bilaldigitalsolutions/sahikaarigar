# 🛠️ SahiKaarigar - Project Analysis V2 (Synced)

## 📌 Project Overview
**Name:** SahiKaarigar  
**Type:** Mobile-First Web Application  
**Location:** Hyderabad, India (Phase 1)  
**Budget:** Zero Investment (Free Tools Only)  
**Goal:** Local workers ko search karna, hire karna

---

## 👥 Target Users

| User Type | Description |
|-----------|-------------|
| **Worker** | Kaam karne wala (Electrician, Plumber, etc.) |
| **Employer** | Hire karne wala |
| **Admin** | Platform manager (tum)

---

## 🎯 Core Features (MVP - Minimal)

### Phase 1 (MVP):
- ✅ Worker Registration (Phone OTP + Skills + Area + Photo)
- ✅ Admin Approval (Worker profile approve/reject)
- ✅ Employer Search (Skill + Area filter)
- ✅ Hire Request (Accept/Reject)
- ✅ Phone Privacy (Hidden until hire accepted)

### Phase 2 (Baad mein):
- Reviews/Ratings, Portfolio, Map view, Chat, Payments

---

## 🔧 Technical Stack (V2 - Final)

### Frontend
| Technology | Why | Cost |
|------------|-----|------|
| **Next.js 14** (App Router) | SEO + Mobile-first | FREE |
| **Tailwind CSS** | Responsive design | FREE |
| **PWA Support** | App jaisa feel | FREE |

### Backend
| Technology | Why | Cost |
|------------|-----|------|
| **Next.js API Routes** | Full-stack | FREE |
| **Firebase Auth** | Phone OTP | FREE |
| **Zod** | Input validation | FREE |

### Database
| Technology | Why | Cost |
|------------|-----|------|
| **MongoDB Atlas** | Free 512MB | FREE |
| **Mongoose** | ODM | FREE |

### Security
| Technology | Why | Cost |
|------------|-----|------|
| **Upstash Redis** | Rate limiting | FREE |
| **Firebase Admin** | Token verification | FREE |

### Storage & Hosting
| Technology | Why | Cost |
|------------|-----|------|
| **Firebase Storage** | Images | FREE |
| **Vercel** | Hosting | FREE |

### Total Cost: ₹0 (Zero Investment)

---

## 📐 Database Schema (V2 - With Indexes)

### 1. Users Collection
```javascript
{
  firebaseUid: String (unique, indexed),
  phone: String (unique),
  name: String,
  role: 'worker' | 'employer' | 'admin',
  avatar: String,
  location: {
    area: String,
    city: 'Hyderabad',
    coordinates: { type: 'Point', coordinates: [lng, lat] }
  },
  isActive: Boolean,
  isVerified: Boolean,
  address: String,
  trustScore: Number
}
```

**Indexes:** firebaseUid, phone, location.coordinates (2dsphere)

### 2. WorkerProfiles Collection
```javascript
{
  userId: ObjectId (unique),
  skills: [String],  // lowercase
  experience: Number,
  description: String,
  hourlyRate: Number,
  availability: 'available' | 'busy' | 'offline',
  portfolio: [String],
  rating: { average: Number, count: Number },
  completedJobs: Number,
  serviceAreas: [String],  // lowercase
  location: { type: 'Point', coordinates: [lng, lat] },
  isApproved: Boolean
}
```

**Indexes:** location (2dsphere), skills+isApproved+availability, serviceAreas+isApproved

### 3. HireRequests Collection
```javascript
{
  employerId: ObjectId,
  workerId: ObjectId,
  description: String,
  location: String,
  proposedRate: Number,
  status: 'pending' | 'accepted' | 'rejected' | 'completed',
  phoneRevealed: Boolean  // Privacy flag
}
```

### 4. Reviews Collection
```javascript
{
  hireRequestId: ObjectId,
  reviewerId: ObjectId,
  workerId: ObjectId,
  rating: Number (1-5),
  comment: String
}
```

### 5. Reports Collection (NEW)
```javascript
{
  reporterId: ObjectId,
  reportedUserId: ObjectId,
  reason: 'fake_profile' | 'bad_behavior' | 'spam' | 'harassment',
  description: String,
  status: 'pending' | 'reviewed' | 'resolved'
}
```

---

## 📱 Pages (V2 - Optimized)

### Worker Flow: Register → Wait Approval → Get Requests
### Employer Flow: Register → Search → Hire (1 click)

| Page | URL | Description |
|------|-----|-------------|
| Landing | / | Search + Categories + Top workers |
| Search | /search | Filters + Worker cards |
| Worker Profile | /worker/[id] | Skills, rate, Hire button |
| Worker Register | /register/worker | 4-step form |
| Dashboard | /dashboard | Role-based views |
| Admin Panel | /admin | Approvals, reports |

---

## 🔍 Search (V2 - Optimized)

### Filters:
- Skill, Area, Rating, Rate, Availability, Distance

### Query (Case-insensitive + Geo):
```javascript
query.skills = { $in: ['electrician', 'plumber'] }
query.location = {
  $near: {
    $geometry: { type: 'Point', coordinates: [lng, lat] },
    $maxDistance: 5000  // 5km
  }
}
```

---

## 🔐 Auth (V2 - Firebase Only)

```
1. Firebase SDK → signInWithPhoneNumber()
2. User receives OTP
3. Frontend: user.getIdToken() → backend
4. Backend: verifyIdToken(token)
5. Return user data (NO JWT)
6. Store in httpOnly cookie
```

---

## 🛡️ Security (V2)

### Rate Limiting:
- OTP: 3 per phone per hour
- API: 30 requests per minute

### Privacy:
- Phone hidden until hire accepted
- Report/Block functionality
- Admin approval for workers

---

## 📊 SEO (V2 - Programmatic)

### Dynamic Pages:
- `/skills/[skill]` - 6 skill pages
- `/areas/[area]` - 20 area pages
- `/worker/[id]` - Worker profiles

### Features:
- Dynamic `sitemap.ts`
- `generateMetadata` for all pages
- Person + Service + Breadcrumb schema
- ISR (revalidate: 3600)

### Target Keywords:
- `electrician in ameerpet` (80 searches)
- `plumber near me kukatpally` (50 searches)

---

## 🚀 Development Phases (V2)

### Phase 1: Validation (Week 1)
- WhatsApp validation
- 10+ hires target

### Phase 2: Core Build (Week 2-3)
- Auth + Worker Register
- Admin Approval
- Search + Hire Request

### Phase 3: Launch (Week 4)
- SEO setup
- Deploy on Vercel
- Launch in Ameerpet

---

## 📊 Success Metrics

| Metric | Month 1 | Month 3 | Month 6 |
|--------|---------|---------|---------|
| Workers | 50 | 200 | 500 |
| Employers | 20 | 100 | 300 |
| Hires | 10 | 50 | 200 |
| Organic Visits | 100 | 500 | 1500 |

---

*Project Analysis V2 - Ready for Development*