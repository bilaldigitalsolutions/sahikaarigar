// Review Types
import type { PublicUser } from './user';

export interface Review {
  id: string;
  hireRequestId: string;
  reviewerId: string;
  workerId: string;
  rating: number; // 1-5
  comment?: string | null;
  createdAt: string;
  reviewer: PublicUser | null;
}

export interface ReviewCreateInput {
  hireRequestId: string;
  rating: number;
  comment?: string;
}
