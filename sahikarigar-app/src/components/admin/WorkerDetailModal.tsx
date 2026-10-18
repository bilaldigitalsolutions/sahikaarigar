'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  FileImage,
  IndianRupee,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  X,
  XCircle,
} from 'lucide-react';
import {
  getAdminWorker,
  setWorkerApproval,
  type ApiAdminWorker,
  type VerificationStatus,
} from '@/lib/api';

interface WorkerDetailModalProps {
  workerId: string;
  onClose: () => void;
  onUpdated: () => void;
}

function maskAadhaar(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 12) return value;
  return `XXXX XXXX ${digits.slice(-4)}`;
}

function formatAadhaar(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 12) return value;
  return digits.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3');
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return 'WK';
}

function statusPillClasses(status: VerificationStatus): string {
  if (status === 'approved') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'rejected') return 'bg-red-50 text-red-700 ring-red-200';
  return 'bg-amber-50 text-amber-700 ring-amber-200';
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-[#F9FAFB] px-4 py-3">
      <span className="mt-0.5 text-gray-400">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
          {label}
        </span>
        <span className="mt-0.5 block break-words text-[14px] font-semibold text-[#111827]">
          {children}
        </span>
      </span>
    </div>
  );
}

export function WorkerDetailModal({ workerId, onClose, onUpdated }: WorkerDetailModalProps) {
  const [worker, setWorker] = useState<ApiAdminWorker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { worker: detail } = await getAdminWorker(workerId);
      setWorker(detail);
      setReason(detail.rejectionReason ?? '');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Worker details load nahi hue.');
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [busy, onClose]);

  const decide = async (approved: boolean) => {
    setActionError(null);
    if (!approved && reason.trim().length < 3) {
      setActionError('Reject karne se pehle kam se kam 3 characters ka reason likho.');
      return;
    }
    setBusy(true);
    try {
      await setWorkerApproval(workerId, approved, approved ? undefined : reason.trim());
      onUpdated();
      onClose();
    } catch (failure) {
      setActionError(
        failure instanceof Error ? failure.message : 'Status update nahi hua. Dobara try karo.',
      );
    } finally {
      setBusy(false);
    }
  };

  const name = worker?.user?.name?.trim() || 'Kaarigar';
  const aadhaarFull = formatAadhaar(worker?.aadhaarNumber);
  const aadhaarMasked = maskAadhaar(worker?.aadhaarNumber);
  const category =
    worker && worker.skills.length > 0
      ? worker.skills
          .map((skill) => skill.charAt(0).toUpperCase() + skill.slice(1))
          .join(', ')
      : 'General';
  const location =
    [worker?.user?.locationArea?.trim(), worker?.user?.locationCity?.trim()]
      .filter(Boolean)
      .join(', ') || worker?.serviceAreas?.[0] || 'India';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Worker details: ${name}`}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div className="flex min-w-0 items-center gap-4">
            {worker?.user?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={worker.user.avatar}
                alt={`${name} profile photo`}
                className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-gray-100"
              />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#111827] text-[18px] font-bold text-white">
                {initialsFor(name)}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-[22px] font-extrabold tracking-tight text-[#111827]">
                {loading ? 'Worker details…' : name}
              </h2>
              <p className="mt-0.5 text-[13px] text-gray-500">
                {worker ? `ID #${worker.id.slice(0, 8).toUpperCase()}` : 'Verification review'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {worker && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold capitalize ring-1 ring-inset ${statusPillClasses(
                  worker.verificationStatus,
                )}`}
              >
                {worker.verificationStatus}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close details"
              className="rounded-full border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="space-y-3" aria-busy="true">
              <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-2xl bg-gray-100" />
                ))}
              </div>
              <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-4 text-[14px] text-amber-900">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={17} /> Details load nahi hui
              </p>
              <p className="mt-1">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-3 rounded-full bg-[#111827] px-4 py-2 text-[13px] font-semibold text-white"
              >
                Retry
              </button>
            </div>
          ) : worker ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow icon={<Phone size={17} />} label="Phone number">
                  {worker.user?.phone ? (
                    <a href={`tel:+91${worker.user.phone}`} className="hover:underline">
                      +91 {worker.user.phone}
                    </a>
                  ) : (
                    'Not provided'
                  )}
                </DetailRow>
                <DetailRow icon={<Briefcase size={17} />} label="Skill / Category">
                  {category}
                </DetailRow>
                <DetailRow icon={<CalendarDays size={17} />} label="Experience">
                  {worker.experience} {worker.experience === 1 ? 'year' : 'years'}
                </DetailRow>
                <DetailRow icon={<IndianRupee size={17} />} label="Expected rate">
                  Rs.{worker.hourlyRate.toLocaleString('en-IN')} / hour
                </DetailRow>
                <DetailRow icon={<MapPin size={17} />} label="Location">
                  {location}
                </DetailRow>
                <DetailRow icon={<Star size={17} />} label="Rating">
                  {worker.ratingCount
                    ? `${Number(worker.ratingAverage ?? 0).toFixed(1)} (${worker.ratingCount} reviews)`
                    : 'No reviews yet'}
                </DetailRow>
              </div>

              {worker.serviceAreas.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                    Service areas
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {worker.serviceAreas.map((area) => (
                      <span
                        key={area}
                        className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[12px] font-medium text-gray-600"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {worker.description && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                    About
                  </p>
                  <p className="mt-1 text-[14px] leading-relaxed text-gray-600">
                    {worker.description}
                  </p>
                </div>
              )}

              <section className="rounded-2xl border border-gray-100 p-4">
                <p className="flex items-center gap-2 text-[14px] font-bold text-[#111827]">
                  <ShieldCheck size={17} className="text-emerald-600" /> Aadhaar verification
                </p>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F9FAFB] px-3.5 py-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                      Aadhaar number
                    </p>
                    <p className="mt-0.5 font-mono text-[15px] font-semibold tracking-[0.08em] text-[#111827]">
                      {aadhaarFull ? (showAadhaar ? aadhaarFull : aadhaarMasked) : 'Not provided'}
                    </p>
                  </div>
                  {aadhaarFull && (
                    <button
                      type="button"
                      onClick={() => setShowAadhaar((current) => !current)}
                      aria-label={showAadhaar ? 'Hide Aadhaar number' : 'Show Aadhaar number'}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      {showAadhaar ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showAadhaar ? 'Hide' : 'Show'}
                    </button>
                  )}
                </div>

                <div className="mt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                    Aadhaar photo
                  </p>
                  {worker.aadhaarPhotoUrl ? (
                    <a
                      href={worker.aadhaarPhotoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group mt-2 block overflow-hidden rounded-2xl border border-gray-200 bg-gray-50"
                      title="Open Aadhaar photo in a new tab"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={worker.aadhaarPhotoUrl}
                        alt={`Aadhaar document for ${name}`}
                        className="max-h-[320px] w-full object-contain"
                      />
                      <span className="flex items-center justify-center gap-1.5 border-t border-gray-200 bg-white px-3 py-2 text-[12px] font-semibold text-gray-600 group-hover:text-[#111827]">
                        Open full size <ExternalLink size={13} />
                      </span>
                    </a>
                  ) : (
                    <div className="mt-2 flex items-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-[13px] text-gray-400">
                      <FileImage size={18} /> No Aadhaar photo uploaded.
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-gray-400">
                    Private document — the link expires after 5 minutes.
                  </p>
                </div>
              </section>

              {worker.verificationStatus === 'rejected' && worker.rejectionReason && (
                <div className="rounded-2xl border border-red-200 bg-red-50/60 px-4 py-3 text-[13px] text-red-800">
                  <p className="font-semibold">Rejection reason</p>
                  <p className="mt-1">{worker.rejectionReason}</p>
                </div>
              )}

              {actionError && (
                <div
                  className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-[13px] font-medium text-amber-900"
                  role="alert"
                >
                  {actionError}
                </div>
              )}

              {rejecting ? (
                <div className="rounded-2xl border border-red-200 bg-red-50/40 p-4">
                  <label
                    htmlFor="reject-reason"
                    className="block text-[13px] font-semibold text-red-900"
                  >
                    Rejection reason (required)
                  </label>
                  <textarea
                    id="reject-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Jaise: Aadhaar photo saaf nahi hai, dobara upload karein."
                    className="mt-2 w-full rounded-xl border border-red-200 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-red-400"
                  />
                  <p className="mt-1 text-right text-[11px] text-gray-400">{reason.length}/500</p>
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRejecting(false);
                        setActionError(null);
                      }}
                      disabled={busy}
                      className="rounded-full border border-gray-200 bg-white px-4 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void decide(false)}
                      disabled={busy || reason.trim().length < 3}
                      className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      <XCircle size={14} /> {busy ? 'Rejecting…' : 'Confirm rejection'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setRejecting(true);
                      setActionError(null);
                    }}
                    disabled={busy || worker.verificationStatus === 'rejected'}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => void decide(true)}
                    disabled={busy || worker.verificationStatus === 'approved'}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#111827] px-5 py-2 text-[13px] font-semibold text-white hover:bg-black disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} /> {busy ? 'Saving…' : 'Approve worker'}
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default WorkerDetailModal;
