// Review Types
import type { PublicUser } from './user';
import type { WorkerProfile } from './worker';

export interface Review {
  id: string;
  hireRequestId: string;
  reviewerId: string;
  workerId: string;
  rating: number; // 1-5
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewCreateInput {
  hireRequestId: string;
  rating: number;
  comment?: string;
}

export interface ReviewWithReviewer extends Review {
  reviewer?: PublicUser;
  worker?: WorkerProfile & { user?: PublicUser };
}
