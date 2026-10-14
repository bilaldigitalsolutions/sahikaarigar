// Worker Types
import type { PublicUser } from './user';

export type Skill =
  | 'electrician'
  | 'plumber'
  | 'painter'
  | 'carpenter'
  | 'ac repair'
  | 'cleaning'
  | 'driver'
  | 'mason'
  | 'welder'
  | 'mechanic'
  | 'gardener'
  | 'cook';

export type Availability = 'available' | 'busy' | 'offline';

export interface WorkerProfile {
  id: string;
  userId: string;
  skills: Skill[];
  experience: number;
  description?: string | null;
  hourlyRate: number;
  availability: Availability;
  portfolio: string[];
  ratingAverage: number;
  ratingCount: number;
  completedJobs: number;
  serviceAreas: string[];
  lat?: number | null;
  lng?: number | null;
  isApproved: boolean;
  adminNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerProfileCreateInput {
  userId: string;
  skills: Skill[];
  experience: number;
  description?: string;
  hourlyRate: number;
  serviceAreas: string[];
  lat?: number;
  lng?: number;
}

export interface WorkerProfileUpdateInput {
  skills?: Skill[];
  experience?: number;
  description?: string;
  hourlyRate?: number;
  availability?: Availability;
  portfolio?: string[];
  serviceAreas?: string[];
  lat?: number;
  lng?: number;
}

export interface WorkerSearchFilters {
  skills?: Skill[];
  area?: string;
  minRating?: number;
  maxRate?: number;
  lat?: number;
  lng?: number;
  maxDistance?: number; // in km
  page?: number;
  limit?: number;
}

export interface WorkerWithUser extends WorkerProfile {
  user: PublicUser;
  /** Populated only when a lat/lng based search is performed. */
  distanceKm?: number | null;
}
