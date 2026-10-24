// Hire Request Types
import type { PublicUser } from './user';
import type { Availability, WorkerBadge } from './worker';

export type HireStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'cancelled'
  | 'en_route'
  | 'arrived'
  | 'in_progress';

/** Every state transition the API understands for a hire request. */
export type HireAction =
  | 'accept'
  | 'reject'
  | 'en_route'
  | 'arrived'
  | 'start'
  | 'complete'
  | 'cancel';

export interface HireWorker {
  id: string;
  userId: string;
  skills: string[];
  hourlyRate: number;
  ratingAverage: number;
  ratingCount: number;
  completedJobs: number;
  totalJobsCompleted: number;
  onTimeJobs: number;
  customerRatingAvg: number;
  systemRatingScore: number;
  badge: WorkerBadge;
  availability: Availability;
  user: PublicUser | null;
}

export interface Hire {
  id: string;
  employerId: string;
  workerId: string;
  description: string;
  location: string;
  proposedRate: number;
  status: HireStatus;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  /** Customer -> worker distance saved when the booking was created. */
  distanceKm?: number | null;
  /** Distance-derived arrival window: 20 / 35 / 50 minutes. */
  expectedArrivalMinutes?: number | null;
  /** null until arrival, then true when on time / false when late. */
  arrivedOnTime?: boolean | null;
  completedAt?: string | null;
  enRouteAt?: string | null;
  arrivedAt?: string | null;
  arrivedTime?: string | null;
  startedAt?: string | null;
  workerLat?: number | null;
  workerLng?: number | null;
  phoneRevealed: boolean;
  createdAt: string;
  updatedAt: string;
  employer: PublicUser | null;
  worker: HireWorker | null;
}

export interface HireCreateInput {
  workerId: string;
  description: string;
  location: string;
  proposedRate: number;
  name?: string;
}
