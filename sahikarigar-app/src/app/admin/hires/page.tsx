'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, Lock } from 'lucide-react';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  listAdminHires,
  displayName,
  type AdminHireStatus,
  type ApiAdminHire,
  type ApiWorkerLifetimeStats,
} from '@/lib/api';

const STATUS_OPTIONS: AdminHireStatus[] = [
  'pending', 'accepted', 'en_route', 'arrived', 'rejected', 'completed', 'cancelled',
];
const FILTERS = ['all', ...STATUS_OPTIONS] as const;

function statusBadgeClasses(status: AdminHireStatus): string {
  switch (status) {
    case 'accepted':
      return 'bg-blue-50 text-blue-700 ring-blue-200';
    case 'en_route':
    case 'arrived':
      return 'bg-violet-50 text-violet-700 ring-violet-200';
    case 'rejected':
      return 'bg-red-50 text-red-700 ring-red-200';
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'cancelled':
      return 'bg-gray-100 text-gray-600 ring-gray-200';
    case 'pending':
    default:
      return 'bg-amber-50 text-amber-700 ring-amber-200';
  }
}

function PerfPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'red' | 'blue';
}) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {label}: {value}
    </span>
  );
}

function WorkerPerformance({ stats }: { stats?: ApiWorkerLifetimeStats }) {
  if (!stats) return null;
  return (
    <span className="mt-2 block">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
        Worker lifetime stats
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-1">
        <PerfPill label="Accepted" value={stats.accepted} tone="emerald" />
        <PerfPill label="Rejected" value={stats.rejected} tone="red" />
        <PerfPill label="Completed" value={stats.completed} tone="blue" />
        <span className="text-[11px] font-medium text-gray-400">
          {stats.total} total (all requests)
        </span>
      </span>
    </span>
  );
}

export default function AdminHiresPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [hires, setHires] = useState<ApiAdminHire[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listAdminHires(filter, page)
      .then(({ hires: result, pagination: pageInfo }) => {
        if (!cancelled) {
          if (page > Math.max(pageInfo.pages, 1)) {
            setPage(Math.max(pageInfo.pages, 1));
            return;
          }
          setHires(result);
          setPagination({ pages: pageInfo.pages, total: pageInfo.total });
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Hire list load nahi hui.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, page]);

  return (
    <div className="space-y-6 text-[#111827]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight">Hire Requests</h1>
          <p className="mt-1 text-[14px] text-gray-500">
            Monitor hire requests and worker performance. Status changes are controlled by the
            worker and employer only.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-[13px] font-semibold text-gray-600">
          <ClipboardList size={15} /> {pagination.total} {filter === 'all' ? 'total' : filter}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[14px] font-medium text-gray-500">
          Status
          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as (typeof FILTERS)[number]);
              setPage(1);
            }}
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-[14px] font-medium text-[#111827] outline-none"
          >
            {FILTERS.map((status) => (
              <option key={status} value={status}>
                {status === 'all' ? 'All statuses' : status.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-[12px] font-semibold text-gray-500">
          <Lock size={13} /> Read-only status
        </span>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-[14px] font-medium text-amber-900" role="alert">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">
                <th className="px-5 py-3.5">Request</th>
                <th className="px-5 py-3.5">Employer</th>
                <th className="px-5 py-3.5">Worker</th>
                <th className="px-5 py-3.5">Request status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-gray-400">
                    Loading hire requests…
                  </td>
                </tr>
              ) : hires.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-gray-400">
                    Is filter ke liye koi hire nahi hai.
                  </td>
                </tr>
              ) : (
                hires.map((hire) => {
                  const lifetimeStats =
                    hire.worker?.lifetimeStats ?? hire.workerLifetimeStats;
                  return (
                    <tr key={hire.id} className="align-top hover:bg-gray-50/60">
                      <td className="px-5 py-4">
                        <span className="block font-bold leading-snug text-[#111827]">
                          {hire.description}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-gray-500">
                          <span className="font-semibold text-[#111827]">
                            ₹{hire.proposedRate.toLocaleString('en-IN')}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span>
                            {new Date(hire.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span className="inline-flex items-center gap-1">
                            <span aria-hidden="true">📍</span>
                            {hire.location}
                          </span>
                        </span>
                        <span className="mt-1 block font-mono text-[11px] text-gray-400">
                          #{hire.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="block font-medium text-[#111827]">
                          {hire.employer ? displayName(hire.employer.name) : '—'}
                        </span>
                        <span className="block text-[12px] text-gray-500">
                          {hire.employer?.phone ? (
                            <a href={`tel:+91${hire.employer.phone}`} className="hover:underline">
                              +91 {hire.employer.phone}
                            </a>
                          ) : (
                            'Phone not available'
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="block font-medium text-[#111827]">
                          {hire.worker ? displayName(hire.worker.name) : '—'}
                        </span>
                        <span className="block text-[12px] text-gray-500">
                          {hire.worker?.phone ? (
                            <a href={`tel:+91${hire.worker.phone}`} className="hover:underline">
                              +91 {hire.worker.phone}
                            </a>
                          ) : (
                            'Phone not available'
                          )}
                        </span>
                        <WorkerPerformance stats={lifetimeStats} />
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold capitalize ring-1 ring-inset ${statusBadgeClasses(hire.status)}`}
                        >
                          {hire.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && hires.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-3.5">
            <AdminPagination
              page={page}
              pages={pagination.pages}
              total={pagination.total}
              onPageChange={setPage}
            />
          </div>
        )}
      </section>
    </div>
  );
}
