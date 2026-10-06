// Report Types
export type ReportReason = 'fake_profile' | 'bad_behavior' | 'spam' | 'harassment' | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved';

export interface Report {
  id: string;
  reporterId: string;
  reportedUserId: string;
  reason: ReportReason;
  description?: string | null;
  status: ReportStatus;
  adminNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportCreateInput {
  reportedUserId: string;
  reason: ReportReason;
  description?: string;
}
