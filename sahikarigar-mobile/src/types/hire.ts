// Hire Request Types
import type { PublicUser } from './user';
import type { Availability } from './worker';

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
  completedAt?: string | null;
  enRouteAt?: string | null;
  arrivedAt?: string | null;
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
