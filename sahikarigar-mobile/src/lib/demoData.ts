// =============================================================================
// Demo / offline data
// =============================================================================
// Lets the whole journey be explored — search → worker profile → hire →
// task complete → feedback — even when the backend can't be reached (e.g. the
// browser blocks the request via CORS). `lib/api.ts` falls back to this data on
// a *network* error only; real API errors still surface normally.
// =============================================================================

import type { HireAction, User } from '@/types';

import type { ApiHire, ApiPublicUser, ApiReview, ApiWorker } from './api';

// ---------------------------------------------------------------------------
// Demo session user
// ---------------------------------------------------------------------------

export const DEMO_USER: User = {
  id: 'demo-user',
  authUserId: 'demo-auth-user',
  phone: '9876543210',
  name: 'Demo User',
  role: 'employer',
  avatar: null,
  locationArea: 'gachibowli',
  locationCity: 'Hyderabad',
  lat: 17.4401,
  lng: 78.3489,
  isActive: true,
  isVerified: true,
  address: null,
  trustScore: 82,
  createdAt: '2026-01-01T09:00:00.000Z',
  updatedAt: '2026-01-01T09:00:00.000Z',
};

/** True once the app has decided to run on demo data (set by AuthContext). */
export let demoMode = false;

export function setDemoMode(value: boolean): void {
  demoMode = value;
}

// ---------------------------------------------------------------------------
// Test worker profiles — a ready-made "test profile" for every skill
// ---------------------------------------------------------------------------

export const DEMO_WORKERS: ApiWorker[] = [
  {
    id: 'demo-worker-1',
    userId: 'demo-wu-1',
    skills: ['plumber'],
    experience: 5,
    description:
      'Expert plumber for leak repairs, tap and pipe fitting, bathroom fittings and water tank cleaning. Neat work, fair rates.',
    hourlyRate: 250,
    availability: 'available',
    portfolio: [],
    ratingAverage: 4.8,
    ratingCount: 98,
    completedJobs: 124,
    totalJobsCompleted: 124,
    onTimeJobs: 118,
    customerRatingAvg: 4.8,
    systemRatingScore: 95.16,
    badge: 'Gold',
    serviceAreas: ['banjara-hills', 'jubilee-hills'],
    lat: 17.4126,
    lng: 78.4392,
    isApproved: true,
    user: {
      id: 'demo-wu-1',
      name: 'Rajesh Kumar',
      avatar: null,
      phone: '9811111111',
      locationArea: 'banjara-hills',
      locationCity: 'Hyderabad',
      isVerified: true,
      trustScore: 92,
    },
  },
  {
    id: 'demo-worker-2',
    userId: 'demo-wu-2',
    skills: ['electrician'],
    experience: 7,
    description:
      'Licensed electrician — wiring, MCB and inverter installation, fan and light fitting, fault finding. Emergency visits available.',
    hourlyRate: 280,
    availability: 'available',
    portfolio: [],
    ratingAverage: 4.6,
    ratingCount: 54,
    completedJobs: 86,
    totalJobsCompleted: 86,
    onTimeJobs: 72,
    customerRatingAvg: 4.6,
    systemRatingScore: 83.72,
    badge: 'Silver',
    serviceAreas: ['kukatpally', 'miyapur'],
    lat: 17.4849,
    lng: 78.4138,
    isApproved: true,
    user: {
      id: 'demo-wu-2',
      name: 'Mohammed Ali',
      avatar: null,
      phone: '9822222222',
      locationArea: 'kukatpally',
      locationCity: 'Hyderabad',
      isVerified: true,
      trustScore: 88,
    },
  },
  {
    id: 'demo-worker-3',
    userId: 'demo-wu-3',
    skills: ['cleaning'],
    experience: 4,
    description:
      'Deep home cleaning, sofa and mattress shampooing, kitchen and bathroom cleaning. Trained, background-verified team.',
    hourlyRate: 300,
    availability: 'busy',
    portfolio: [],
    ratingAverage: 4.9,
    ratingCount: 210,
    completedJobs: 302,
    totalJobsCompleted: 302,
    onTimeJobs: 290,
    customerRatingAvg: 4.9,
    systemRatingScore: 96.03,
    badge: 'Gold',
    serviceAreas: ['gachibowli', 'hitech-city', 'madhapur'],
    lat: 17.4401,
    lng: 78.3489,
    isApproved: true,
    user: {
      id: 'demo-wu-3',
      name: 'Hyderabad Cleaning Services',
      avatar: null,
      phone: '9833333333',
      locationArea: 'gachibowli',
      locationCity: 'Hyderabad',
      isVerified: true,
      trustScore: 95,
    },
  },
  {
    id: 'demo-worker-4',
    userId: 'demo-wu-4',
    skills: ['painter', 'carpenter'],
    experience: 6,
    description:
      'Interior and exterior painting, putty work, and custom furniture repair. Free colour consultation on site.',
    hourlyRate: 220,
    availability: 'available',
    portfolio: [],
    ratingAverage: 4.7,
    ratingCount: 63,
    completedJobs: 71,
    totalJobsCompleted: 71,
    onTimeJobs: 45,
    customerRatingAvg: 4.7,
    systemRatingScore: 63.38,
    badge: 'Bronze',
    serviceAreas: ['madhapur', 'hitech-city'],
    lat: 17.4483,
    lng: 78.3915,
    isApproved: true,
    user: {
      id: 'demo-wu-4',
      name: 'Suresh Yadav',
      avatar: null,
      phone: '9844444444',
      locationArea: 'madhapur',
      locationCity: 'Hyderabad',
      isVerified: true,
      trustScore: 85,
    },
  },
];

// ---------------------------------------------------------------------------
// Test reviews
// ---------------------------------------------------------------------------

function demoReviewer(id: string, name: string): ApiPublicUser {
  return { id, name, avatar: null, locationCity: 'Hyderabad' };
}

export const DEMO_REVIEWS: ApiReview[] = [
  {
    id: 'demo-rv-1',
    hireRequestId: 'demo-h1',
    reviewerId: 'demo-r1',
    workerId: 'demo-worker-1',
    rating: 5,
    comment: 'Fixed the kitchen leak in 30 minutes. Very professional and clean work.',
    createdAt: '2026-09-20T10:15:00.000Z',
    reviewer: demoReviewer('demo-r1', 'Anita Sharma'),
  },
  {
    id: 'demo-rv-2',
    hireRequestId: 'demo-h2',
    reviewerId: 'demo-r2',
    workerId: 'demo-worker-1',
    rating: 5,
    comment: 'On time, fair price and explained everything clearly. Recommended.',
    createdAt: '2026-09-02T17:40:00.000Z',
    reviewer: demoReviewer('demo-r2', 'Vikram Reddy'),
  },
  {
    id: 'demo-rv-3',
    hireRequestId: 'demo-h3',
    reviewerId: 'demo-r3',
    workerId: 'demo-worker-2',
    rating: 5,
    comment: 'Sorted out a tricky wiring fault quickly. Very knowledgeable.',
    createdAt: '2026-09-11T09:05:00.000Z',
    reviewer: demoReviewer('demo-r3', 'Priya Nair'),
  },
  {
    id: 'demo-rv-4',
    hireRequestId: 'demo-h4',
    reviewerId: 'demo-r4',
    workerId: 'demo-worker-2',
    rating: 4,
    comment: 'Good work overall, arrived a little later than promised.',
    createdAt: '2026-08-28T14:20:00.000Z',
    reviewer: demoReviewer('demo-r4', 'Imran Khan'),
  },
  {
    id: 'demo-rv-5',
    hireRequestId: 'demo-h5',
    reviewerId: 'demo-r5',
    workerId: 'demo-worker-3',
    rating: 5,
    comment: 'The team did a fantastic deep clean of our 3BHK. Spotless.',
    createdAt: '2026-09-25T11:30:00.000Z',
    reviewer: demoReviewer('demo-r5', 'Sneha Rao'),
  },
  {
    id: 'demo-rv-6',
    hireRequestId: 'demo-h6',
    reviewerId: 'demo-r6',
    workerId: 'demo-worker-4',
    rating: 5,
    comment: 'Neat painting, no mess left behind. Great finish on the walls.',
    createdAt: '2026-09-18T16:10:00.000Z',
    reviewer: demoReviewer('demo-r6', 'Karthik Menon'),
  },
];

// ---------------------------------------------------------------------------
// Local (in-memory) hires — lets the full flow run with no backend at all
// ---------------------------------------------------------------------------

const localHires = new Map<string, ApiHire>();
const localReviews: ApiReview[] = [];
let hireCounter = 0;

const nowIso = () => new Date().toISOString();

export function listLocalHires(): ApiHire[] {
  return [...localHires.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getLocalHire(id: string): ApiHire | null {
  return localHires.get(id) ?? null;
}

export function saveLocalHire(hire: ApiHire): void {
  localHires.set(hire.id, hire);
}

export function createLocalHire(input: {
  workerId: string;
  description: string;
  location: string;
  proposedRate: number;
  name?: string;
}): ApiHire {
  hireCounter += 1;
  const worker = findDemoWorker(input.workerId);

  const hire: ApiHire = {
    id: `demo-hire-${hireCounter}`,
    employerId: DEMO_USER.id,
    workerId: input.workerId,
    description: input.description,
    location: input.location,
    proposedRate: input.proposedRate,
    status: 'pending',
    scheduledDate: null,
    scheduledTime: nowIso(),
    distanceKm: null,
    expectedArrivalMinutes: 35,
    arrivedOnTime: null,
    completedAt: null,
    enRouteAt: null,
    arrivedAt: null,
    arrivedTime: null,
    workerLat: null,
    workerLng: null,
    phoneRevealed: false,
    startOtp: String(Math.floor(1000 + Math.random() * 9000)),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    employer: {
      id: DEMO_USER.id,
      name: input.name ?? DEMO_USER.name,
      avatar: null,
      phone: DEMO_USER.phone,
      locationCity: 'Hyderabad',
    },
    worker: worker
      ? {
          id: worker.id,
          userId: worker.userId,
          skills: worker.skills,
          hourlyRate: worker.hourlyRate,
          ratingAverage: worker.ratingAverage,
          ratingCount: worker.ratingCount,
          completedJobs: worker.completedJobs,
          totalJobsCompleted: worker.totalJobsCompleted,
          onTimeJobs: worker.onTimeJobs,
          customerRatingAvg: worker.customerRatingAvg,
          systemRatingScore: worker.systemRatingScore,
          badge: worker.badge,
          availability: worker.availability,
          user: worker.user,
        }
      : null,
  };

  saveLocalHire(hire);
  return hire;
}

const NEXT_STATUS: Record<HireAction, ApiHire['status']> = {
  accept: 'accepted',
  reject: 'rejected',
  en_route: 'en_route',
  arrived: 'arrived',
  start: 'in_progress',
  complete: 'completed',
  cancel: 'cancelled',
};

export function applyLocalAction(
  hire: ApiHire,
  action: HireAction,
  coords?: { lat?: number; lng?: number },
  otp?: string,
): ApiHire {
  // "Start Work" needs the same 4-digit OTP the demo employer screen shows —
  // a wrong code must fail here too, exactly like the real server would.
  if (action === 'start') {
    const code = String(otp ?? '').trim();
    if (!hire.startOtp || code !== hire.startOtp) {
      throw new Error('OTP galat hai — customer ke screen ka sahi code daalo');
    }
  }
  const updated: ApiHire = {
    ...hire,
    status: NEXT_STATUS[action],
    updatedAt: nowIso(),
    phoneRevealed: action === 'accept' ? true : hire.phoneRevealed,
    enRouteAt: action === 'en_route' ? nowIso() : hire.enRouteAt,
    arrivedAt: action === 'arrived' ? nowIso() : hire.arrivedAt,
    arrivedTime: action === 'arrived' ? nowIso() : hire.arrivedTime,
    arrivedOnTime: action === 'arrived' ? true : hire.arrivedOnTime,
    startedAt: action === 'start' ? nowIso() : hire.startedAt,
    startOtp: action === 'start' ? null : hire.startOtp,
    completedAt: action === 'complete' ? nowIso() : hire.completedAt,
    workerLat: coords?.lat ?? hire.workerLat,
    workerLng: coords?.lng ?? hire.workerLng,
  };
  saveLocalHire(updated);
  return updated;
}

export function addLocalReview(input: {
  hireRequestId: string;
  workerId: string;
  rating: number;
  comment?: string;
  tip?: number;
  likes?: string[];
}): ApiReview {
  const review: ApiReview = {
    id: `demo-review-${localReviews.length + 1}`,
    hireRequestId: input.hireRequestId,
    reviewerId: DEMO_USER.id,
    workerId: input.workerId,
    rating: input.rating,
    comment: input.comment ?? null,
    tip: input.tip ?? 0,
    likes: input.likes ?? [],
    createdAt: nowIso(),
    reviewer: { id: DEMO_USER.id, name: DEMO_USER.name, avatar: null },
  };
  localReviews.push(review);
  return review;
}

export function findLocalReview(hireRequestId: string): ApiReview | null {
  return localReviews.find((r) => r.hireRequestId === hireRequestId) ?? null;
}

export function findDemoWorker(id: string): ApiWorker | null {
  return DEMO_WORKERS.find((w) => w.id === id) ?? null;
}

export function reviewsForWorker(workerId: string): ApiReview[] {
  return [...DEMO_REVIEWS, ...localReviews].filter((r) => r.workerId === workerId);
}

/** Filter the test profiles the same way the search screen does. */
export function filterDemoWorkers(params: { skill?: string; area?: string }): ApiWorker[] {
  return DEMO_WORKERS.filter((worker) => {
    if (params.skill && !worker.skills.includes(params.skill)) return false;
    if (params.area) {
      const needle = params.area.toLowerCase();
      const areas = [...worker.serviceAreas, worker.user?.locationArea ?? ''].filter(Boolean);
      if (!areas.some((a) => needle.includes(a.toLowerCase()) || a.toLowerCase().includes(needle))) {
        return false;
      }
    }
    return true;
  });
}


