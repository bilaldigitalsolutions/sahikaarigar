'use client';

import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  listAdminHires,
  setAdminHireStatus,
  type AdminHireStatus,
  type ApiAdminHire,
} from '@/lib/api';

const STATUS_OPTIONS: AdminHireStatus[] = [
  'pending', 'accepted', 'en_route', 'arrived', 'rejected', 'completed', 'cancelled',
];
const FILTERS = ['all', ...STATUS_OPTIONS] as const;

export default function AdminHiresPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [hires, setHires] = useState<ApiAdminHire[]>([]);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pagination, setPagination] = useState({ pages: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
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
  }, [filter, page, refreshKey]);

  async function changeStatus(hire: ApiAdminHire, status: AdminHireStatus) {
    if (hire.status === status) return;
    setBusyId(hire.id);
    setError(null);
    try {
      await setAdminHireStatus(hire.id, status);
      setRefreshKey((current) => current + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Hire status update nahi hua.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 text-[#111827]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight">Hire Requests</h1>
          <p className="mt-1 text-[14px] text-gray-500">
            Monitor ongoing hires, payments and completion status in real-time.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-[13px] font-semibold text-gray-600">
          <ClipboardList size={15} /> {pagination.total} {filter === 'all' ? 'total' : filter}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
            {FILTERS.map((status) => <option key={status} value={status}>{status === 'all' ? 'All statuses' : status.replace('_', ' ')}</option>)}
          </select>
        </label>
      </div>

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
                <th className="px-5 py-3.5">Request</th>
                <th className="px-5 py-3.5">Employer</th>
                <th className="px-5 py-3.5">Worker</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-gray-400">
                    Loading hire requests…
                  </td>
                </tr>
              ) : hires.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-gray-400">
                    Is filter ke liye koi hire nahi hai.
                  </td>
                </tr>
              ) : (
                hires.map((hire) => (
                  <tr key={hire.id} className="align-top hover:bg-gray-50/60">
                    <td className="px-5 py-3.5">
                      <span className="block font-semibold">{hire.description}</span>
                      <span className="mt-0.5 block text-[12px] text-gray-400">
                        {hire.location} · Rs.{hire.proposedRate} · {new Date(hire.createdAt).toLocaleDateString('en-IN')}
                      </span>
                      <span className="block font-mono text-[11px] text-gray-400">
                        #{hire.id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      <span className="block font-medium text-[#111827]">{hire.employer?.name ?? '—'}</span>
                      <span className="block text-[12px] text-gray-400">
                        {hire.employer?.phone ? `+91 ${hire.employer.phone}` : ''}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      <span className="block font-medium text-[#111827]">{hire.worker?.name ?? '—'}</span>
                      <span className="block text-[12px] text-gray-400">
                        {hire.worker?.phone ? `+91 ${hire.worker.phone}` : ''}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[12px] font-semibold capitalize text-gray-600">
                        {hire.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <select
                        aria-label={`Change hire ${hire.id} status`}
                        value={hire.status}
                        disabled={busyId === hire.id}
                        onChange={(event) => void changeStatus(hire, event.target.value as AdminHireStatus)}
                        className="rounded-full border border-gray-200 bg-white px-3 py-2 text-[13px] font-medium capitalize outline-none disabled:opacity-60"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>{status.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
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
