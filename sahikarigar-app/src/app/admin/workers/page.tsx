'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, Search, UserCheck } from 'lucide-react';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { WorkerDetailModal } from '@/components/admin/WorkerDetailModal';
import {
  listAdminWorkers,
  type ApiAdminWorker,
  type VerificationStatus,
} from '@/lib/api';

const STATUSES: { value: VerificationStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const AVATAR_COLORS = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-orange-500'];

function initialsFor(name: string, index: number): { initials: string; bg: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts.length === 1 && parts[0].length >= 2
        ? parts[0].slice(0, 2).toUpperCase()
        : 'WK';
  return { initials, bg: AVATAR_COLORS[index % AVATAR_COLORS.length] };
}

function statusPillClasses(status: VerificationStatus): string {
  if (status === 'approved') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'rejected') return 'bg-red-50 text-red-700 ring-red-200';
  return 'bg-amber-50 text-amber-700 ring-amber-200';
}

export default function WorkerApprovalsPage() {
  const [status, setStatus] = useState<VerificationStatus>('pending');
  const [workers, setWorkers] = useState<ApiAdminWorker[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminWorkers(status, page);
      if (page > Math.max(result.pagination.pages, 1)) {
        setPage(Math.max(result.pagination.pages, 1));
        return;
      }
      setWorkers(result.workers);
      setPagination({ pages: result.pagination.pages, total: result.pagination.total });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Worker list load nahi hui.');
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = workers.filter((worker) => {
    const term = query.trim().toLowerCase();
    if (!term) return true;
    const name = (worker.user?.name ?? '').toLowerCase();
    const phone = (worker.user?.phone ?? '').toLowerCase();
    return name.includes(term) || phone.includes(term);
  });

  return (
    <div className="space-y-6 text-[#111827]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight">Worker Verification</h1>
          <p className="mt-1 text-[14px] text-gray-500">
            Review documents, background checks and approve trusted workers.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-[13px] font-semibold text-gray-600">
          <UserCheck size={15} /> {pagination.total} {status}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Verification status">
        {STATUSES.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={status === item.value}
            onClick={() => {
              setStatus(item.value);
              setPage(1);
            }}
            className={`rounded-full px-4 py-2 text-[14px] font-medium ${
              status === item.value
                ? 'bg-[#111827] text-white'
                : 'border border-gray-200 bg-white text-gray-500 hover:text-[#111827]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3.5 py-2.5 text-[14px] text-gray-400">
        <Search size={17} className="shrink-0" />
        <input
          type="search"
          placeholder="Search workers by name or phone..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full bg-transparent text-[#111827] outline-none placeholder:text-gray-400"
        />
      </label>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-[14px] font-medium text-amber-900" role="alert">
          {error}
        </div>
      )}
      <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">
                <th className="px-5 py-3.5">Worker</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Location</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Time</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                    Loading workers…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                    Is status me koi worker nahi hai.
                  </td>
                </tr>
              ) : (
                filtered.map((worker, index) => {
                  const name = worker.user?.name?.trim() || 'Kaarigar';
                  const profile = initialsFor(name, index);
                  const category =
                    worker.skills.length > 0
                      ? worker.skills[0].charAt(0).toUpperCase() + worker.skills[0].slice(1)
                      : 'General';
                  const area = worker.user?.locationArea?.trim();
                  const city = worker.user?.locationCity?.trim();
                  const location =
                    [area, city].filter(Boolean).join(', ') || worker.serviceAreas?.[0] || 'India';
                  return (
                    <tr
                      key={worker.id}
                      onClick={() => setSelectedWorkerId(worker.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedWorkerId(worker.id);
                        }
                      }}
                      tabIndex={0}
                      title="Click to view complete details"
                      className="cursor-pointer align-top hover:bg-gray-50/60 focus:bg-gray-50 focus:outline-none"
                    >
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-3">
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ${profile.bg}`}>
                            {profile.initials}
                          </span>
                          <span>
                            <span className="block font-semibold">{name}</span>
                            <span className="block text-[12px] text-gray-400">
                              ID #{worker.id.slice(0, 4).toUpperCase()}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{category}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-gray-500">{location}</td>
                      <td className="px-5 py-3.5">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold capitalize ring-1 ring-inset ${statusPillClasses(worker.verificationStatus)}`}>
                            {worker.verificationStatus}
                          </span>
                          {worker.isFlagged && (
                            <span className="rounded-full bg-red-500 px-2.5 py-1 text-[12px] font-semibold text-white">
                              ⚑ Flagged
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-gray-400">
                        {new Date(worker.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td
                        className="px-5 py-3.5 text-right"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedWorkerId(worker.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          <Eye size={13} /> View details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && workers.length > 0 && (
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

      {selectedWorkerId && (
        <WorkerDetailModal
          workerId={selectedWorkerId}
          onClose={() => setSelectedWorkerId(null)}
          onUpdated={() => void load()}
        />
      )}
    </div>
  );
}
