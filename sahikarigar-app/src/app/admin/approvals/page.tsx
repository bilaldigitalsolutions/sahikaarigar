'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, ShieldCheck, XCircle } from 'lucide-react';
import { Header, Footer } from '@/components';
import { AdminNavigation } from '@/components/admin/AdminNavigation';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { Button, Card } from '@/components/ui';
import { SKILLS } from '@/constants';
import {
  listAdminWorkers,
  setWorkerApproval,
  type ApiAdminWorker,
  type VerificationStatus,
} from '@/lib/api';

const STATUSES: { value: VerificationStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function skillLabel(id: string): string {
  const match = SKILLS.find((skill) => skill.id === id);
  return match ? `${match.icon} ${match.label}` : id;
}

export default function WorkerApprovalsPage() {
  const [status, setStatus] = useState<VerificationStatus>('pending');
  const [workers, setWorkers] = useState<ApiAdminWorker[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 0, total: 0 });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const decide = async (worker: ApiAdminWorker, approved: boolean) => {
    const reason = (reasons[worker.id] ?? '').trim();
    if (!approved && reason.length < 3) {
      setError('Reject karne se pehle kam se kam 3 characters ka reason likho.');
      return;
    }
    setBusyId(worker.id);
    setError(null);
    try {
      await setWorkerApproval(worker.id, approved, approved ? undefined : reason);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Status update nahi hua.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck size={24} className="text-primary-dark" />
          <h1 className="text-2xl font-bold">Worker verification</h1>
        </div>
        <AdminNavigation />

        <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Verification status">
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
              className={`rounded-full border px-4 py-2 text-small font-medium ${
                status === item.value
                  ? 'border-primary-dark bg-primary-dark text-white'
                  : 'border-gray-200 bg-white text-text-secondary'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && <p className="mb-4 rounded-button bg-red-50 px-4 py-3 text-small text-danger" role="alert">{error}</p>}
        {loading ? (
          <Card><p className="py-8 text-center text-text-secondary">Loading workers…</p></Card>
        ) : workers.length === 0 ? (
          <Card><p className="py-8 text-center text-text-secondary">Is status me koi worker nahi hai.</p></Card>
        ) : (
          <div className="space-y-4">
            {workers.map((worker) => (
              <Card key={worker.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">{worker.user?.name ?? 'Kaarigar'}</h2>
                    <p className="text-small text-text-secondary">
                      {worker.user?.phone ? `+91 ${worker.user.phone}` : '—'}
                      {worker.user?.locationArea ? ` · ${worker.user.locationArea}` : ''}
                    </p>
                    <p className="mt-2 text-caption text-text-secondary">
                      ₹{worker.hourlyRate}/hr · {worker.experience} yrs exp ·{' '}
                      {new Date(worker.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-caption font-semibold capitalize ${
                    status === 'approved' ? 'bg-green-100 text-green-800' :
                      status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'
                  }`}>
                    {worker.verificationStatus}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {worker.skills.map((skill) => (
                    <span key={skill} className="rounded-full bg-gray-100 px-2.5 py-1 text-caption text-text-secondary">
                      {skillLabel(skill)}
                    </span>
                  ))}
                </div>
                {worker.description && <p className="mt-3 text-small text-text-secondary">{worker.description}</p>}
                {worker.adminNotes && status === 'rejected' && (
                  <p className="mt-3 rounded-button bg-red-50 px-3 py-2 text-small text-danger">
                    Reject reason: {worker.adminNotes}
                  </p>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-card border border-gray-100 p-3">
                    <p className="mb-2 text-caption font-semibold text-text-secondary">Profile photo</p>
                    {worker.user?.avatar ? (
                      <a href={worker.user.avatar} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-small text-primary-dark">
                        <img src={worker.user.avatar} alt={`${worker.user.name} profile`} className="h-24 w-24 rounded object-cover" />
                        <ExternalLink size={14} />
                      </a>
                    ) : <p className="text-small text-text-secondary">Photo upload nahi ki.</p>}
                  </div>
                  <div className="rounded-card border border-gray-100 p-3">
                    <p className="mb-2 text-caption font-semibold text-text-secondary">Aadhaar photo (private)</p>
                    {worker.aadhaarPhotoUrl ? (
                      <a href={worker.aadhaarPhotoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-small text-primary-dark">
                        <img src={worker.aadhaarPhotoUrl} alt={`${worker.user?.name ?? 'Worker'} Aadhaar document`} className="h-24 w-36 rounded object-cover" />
                        <ExternalLink size={14} />
                      </a>
                    ) : <p className="text-small text-text-secondary">Aadhaar photo available nahi hai.</p>}
                  </div>
                </div>

                {status === 'pending' && (
                  <div className="mt-4 border-t pt-4">
                    <label htmlFor={`reason-${worker.id}`} className="mb-2 block text-small font-medium">
                      Reject reason (reject karte waqt required)
                    </label>
                    <textarea
                      id={`reason-${worker.id}`}
                      value={reasons[worker.id] ?? ''}
                      maxLength={500}
                      rows={2}
                      onChange={(event) => setReasons((current) => ({ ...current, [worker.id]: event.target.value }))}
                      className="w-full resize-y rounded-button border border-gray-200 bg-white px-3 py-2 text-small"
                      placeholder="Jaise: Aadhaar photo clear nahi hai."
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" isLoading={busyId === worker.id} onClick={() => void decide(worker, true)}>
                        <CheckCircle2 size={15} className="mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="secondary" isLoading={busyId === worker.id} onClick={() => void decide(worker, false)}>
                        <XCircle size={15} className="mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
        {!loading && workers.length > 0 && (
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
