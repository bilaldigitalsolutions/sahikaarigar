# 🛠️ SahiKaarigar - Project Analysis Document

## 📌 Project Overview
**Name:** SahiKaarigar (or finalize later)  
**Type:** Mobile-First Web Application  
**Location:** Hyderabad, India (Phase 1)  
**Budget:** Zero Investment (Free Tools Only)  
**Goal:** Local workers ko search karna, hire karna, aur workers ko register karne ka platform

---

## 👥 Target Users

| User Type | Description | Example |
|-----------|-------------|---------|
| **Worker (Kaamgar)** | Jo kaam karta hai, register karega | Electrician, Plumber, Painter, Driver, Maid |
| **Employer (Malik)** | Jo hire karna chahta hai | Ghar ka kaam, office repair, etc. |
| **Admin** | Platform manage karega | Tum (Super Admin) |

---

## 🎯 Core Features (MVP)

### 👷 Worker Module
- Registration (Name, Phone, Skills, Location, Photo)
- Login (Phone + OTP)
- Profile Edit & Portfolio upload
- Availability toggle (Available/Busy)
- Hire requests (Accept/Reject)

### 🏠 Employer Module
- Registration & Login (Phone + OTP)
- Workers search (Skill + Location filter)
- Worker profile dekhna
- Hire request bhejna
- Review/Rating dena

### 🔍 Search & Filter
- Skill type filter (Electrician, Plumber, etc.)
- Location filter (Hyderabad areas)
- Rating sort
- Availability filter

### ⭐ Reviews & Ratings
- Employer worker ko rate kare (1-5 stars)
- Review likhna
- Average rating profile pe dikhe

### 📱 Admin Panel (Basic)
- Workers approve/reject
- Users list dekhna
- Reports dekhna

---

## 🔧 Technical Stack (FREE - Zero Investment)

### Frontend (Mobile-First Web App)
| Technology | Why | Cost |
|------------|-----|------|
| **Next.js 14** | Best for SEO + Mobile-first + Fast | FREE |
| **Tailwind CSS** | Mobile-first responsive design | FREE |
| **PWA Support** | App jaisa feel phone pe | FREE |

### Backend
| Technology | Why | Cost |
|------------|-----|------|
| **Next.js API Routes** | Frontend + Backend ek saath | FREE |
| **NextAuth.js** | Authentication (Google, Phone OTP) | FREE |

### Database
| Technology | Why | Cost |
|------------|-----|------|
| **MongoDB Atlas** | Free tier 512MB - kaafi hai start ke liye | FREE |
| **Mongoose** | MongoDB ke saath kaam karne ke liye | FREE |

### Phone OTP Authentication
| Technology | Why | Cost |
|------------|-----|------|
| **Firebase Auth** | Free phone auth (10K verifications/month) | FREE |

### File/Image Upload
| Technology | Why | Cost |
|------------|-----|------|
| **Cloudinary** | Free tier 25K transformations/month | FREE |

### Hosting
| Technology | Why | Cost |
|------------|-----|------|
| **Vercel** | Next.js ka best hosting, free tier | FREE |
| **GitHub** | Code repository | FREE |

### Total Cost: ₹0 (ZERO)

---

## 📐 Database Schema Design

### 1. Users Collection
```json
{
  "_id": "ObjectId",
  "phone": "+91XXXXXXXXXX",
  "name": "String",
  "role": "worker | employer | admin",
  "avatar": "String (Cloudinary URL)",
  "location": {
    "area": "String (e.g., Ameerpet)",
    "city": "Hyderabad",
    "lat": "Number",
    "lng": "Number"
  },
  "createdAt": "Date",
  "isActive": "Boolean",
  "isVerified": "Boolean"
}
```

### 2. WorkerProfiles Collection
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId (ref: Users)",
  "skills": ["Electrician", "Plumber"],
  "experience": "Number (years)",
  "description": "String",
  "hourlyRate": "Number",
  "availability": "available | busy | offline",
  "portfolio": ["String (image URLs)"],
  "rating": {
    "average": "Number",
    "count": "Number"
  },
  "completedJobs": "Number",
  "serviceAreas": ["Ameerpet", "Kukatpally"]
}
```

### 3. HireRequests Collection
```json
{
  "_id": "ObjectId",
  "employerId": "ObjectId",
  "workerId": "ObjectId",
  "description": "String (kya kaam karna hai)",
  "location": "String",
  "proposedRate": "Number",
  "status": "pending | accepted | rejected | completed",
  "scheduledDate": "Date",
  "createdAt": "Date"
}
```

### 4. Reviews Collection
```json
{
  "_id": "ObjectId",
  "hireRequestId": "ObjectId",
  "reviewerId": "ObjectId",
  "workerId": "ObjectId",
  "rating": "Number (1-5)",
  "comment": "String",
  "createdAt": "Date"
}
```

---

## 📱 Pages & Screens

### 1. Landing Page (/)
- Hero section - "Hyderabad ke best workers dhundho"
- Search bar (skill + area)
- Popular categories
- How it works section

### 2. Search Page (/search)
- Filters sidebar
- Worker cards list
- Map view toggle

### 3. Worker Profile (/worker/[id])
- Photo, Name, Rating
- Skills, Experience, Rate
- Portfolio images
- Reviews
- "Hire Now" button

### 4. Worker Registration (/register/worker)
- Multi-step form
- Step 1: Basic Info (Name, Phone, OTP)
- Step 2: Skills & Experience
- Step 3: Location & Service Areas
- Step 4: Photo & Portfolio

### 5. Dashboard (/dashboard)
- Worker View: Hire requests, Profile stats
- Employer View: My hires, Active requests

### 6. Admin Panel (/admin)
- Pending approvals
- All users list
- Reports

---

## 🚀 Development Phases

### Phase 1: Setup & Basic Structure (Week 1)
- Next.js project setup
- MongoDB Atlas connection
- Tailwind CSS configuration
- Basic layout & navigation
- Landing page

### Phase 2: Authentication (Week 2)
- Firebase phone OTP setup
- Registration forms
- Login system
- Protected routes

### Phase 3: Worker Features (Week 3)
- Worker profile creation
- Skills & portfolio upload
- Worker search & filter
- Worker detail page

### Phase 4: Hiring System (Week 4)
- Hire request system
- Accept/Reject functionality
- Dashboard for both users

### Phase 5: Reviews & Polish (Week 5)
- Rating & review system
- Admin panel
- PWA setup
- Testing & bug fixes

### Phase 6: Launch (Week 6)
- Final testing
- Deploy on Vercel
- Share in Hyderabad communities
- Collect feedback

---

## 🗺️ Hyderabad Service Areas (Phase 1)

- Ameerpet, Kukatpally, Miyapur
- Gachibowli, Hitech City, Madhapur
- Jubilee Hills, Banjara Hills
- Secunderabad, Begumpet
- LB Nagar, Dilsukhnagar
- Mehdipatnam, Tolichowki
- Uppal, Malkajgiri
- Srinagar Colony, Somajiguda

---

## 💡 Future Features (Phase 2)
- In-app chat/messaging
- Online payments (UPI integration)
- Emergency/urgent hire
- Multi-city expansion

---

## ⚠️ Limitations
1. Hyderabad only start
2. Free tier limits may need upgrade later
3. No real-time chat in MVP
4. Images will be compressed

---

*Document: Ready for Development*  
*Time: 5-6 weeks*  
*Cost: ₹0 (Zero Investment)*