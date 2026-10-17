'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, ShieldCheck } from 'lucide-react';
import { Header, Footer } from '@/components';
import { AdminNavigation } from '@/components/admin/AdminNavigation';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { Card } from '@/components/ui';
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
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <ClipboardList size={24} className="text-primary-dark" />
          <h1 className="text-2xl font-bold">Hire overview</h1>
        </div>
        <AdminNavigation />

        <label className="mb-5 flex max-w-sm items-center gap-3 text-small font-medium">
          Status
          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as (typeof FILTERS)[number]);
              setPage(1);
            }}
            className="flex-1 rounded-button border border-gray-200 bg-white px-3 py-2"
          >
            {FILTERS.map((status) => <option key={status} value={status}>{status === 'all' ? 'All statuses' : status}</option>)}
          </select>
        </label>

        {error && <p className="mb-4 rounded-button bg-red-50 px-4 py-3 text-small text-danger" role="alert">{error}</p>}
        {loading ? (
          <Card><p className="py-8 text-center text-text-secondary">Loading hire requests…</p></Card>
        ) : hires.length === 0 ? (
          <Card><p className="py-8 text-center text-text-secondary">Is filter ke liye koi hire nahi hai.</p></Card>
        ) : (
          <div className="space-y-3">
            {hires.map((hire) => (
              <Card key={hire.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-caption text-text-secondary">Request {hire.id.slice(0, 8)}</p>
                    <h2 className="mt-1 font-semibold">{hire.description}</h2>
                    <p className="text-small text-text-secondary">{hire.location} · ₹{hire.proposedRate}</p>
                    <div className="mt-2 grid gap-1 text-caption text-text-secondary sm:grid-cols-2">
                      <span>Employer: {hire.employer?.name ?? '—'} {hire.employer?.phone ? `(+91 ${hire.employer.phone})` : ''}</span>
                      <span>Worker: {hire.worker?.name ?? '—'} {hire.worker?.phone ? `(+91 ${hire.worker.phone})` : ''}</span>
                    </div>
                    <p className="mt-2 text-caption text-text-secondary">
                      Created {new Date(hire.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-text-secondary" />
                    <select
                      aria-label={`Change hire ${hire.id} status`}
                      value={hire.status}
                      disabled={busyId === hire.id}
                      onChange={(event) => void changeStatus(hire, event.target.value as AdminHireStatus)}
                      className="rounded-button border border-gray-200 bg-white px-3 py-2 text-small capitalize disabled:opacity-60"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{status.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        {!loading && hires.length > 0 && (
          <AdminPagination
            page={page}
            pages={pagination.pages}
            total={pagination.total}
            onPageChange={setPage}
          />
        )}
      </main>
      <Footer />
    </>
  );
}
