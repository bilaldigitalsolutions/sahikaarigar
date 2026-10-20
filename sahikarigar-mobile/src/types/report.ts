// Report Types
// Reasons MUST match ALLOWED_REASONS in auth-server/src/reports.js — anything
// else is rejected server-side with "Galat report reason".
export type ReportReason =
  | 'spam_or_fake_profile'
  | 'fraud_or_scam'
  | 'harassment_or_abuse'
  | 'inappropriate_content'
  | 'other';
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
