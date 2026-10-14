// Hire Request Types
import type { PublicUser } from './user';
import type { WorkerProfile } from './worker';

export type HireStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';

export interface HireRequest {
  id: string;
  employerId: string;
  workerId: string;
  description: string;
  location: string;
  proposedRate: number;
  status: HireStatus;
  scheduledDate?: string | null;
  completedAt?: string | null;
  phoneRevealed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HireRequestCreateInput {
  workerId: string;
  description: string;
  location: string;
  proposedRate: number;
  scheduledDate?: string | Date;
}

export interface HireRequestWithDetails extends HireRequest {
  employer?: PublicUser;
  worker?: WorkerProfile & { user?: PublicUser };
}
