'use client';

// =============================================================================
// /admin — worker approval
// =============================================================================
// New kaarigar profiles are created unapproved and stay invisible in search
// until approved here. Access is limited server-side (ADMIN_PHONES env var, or
// a user whose role is 'admin').
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { Header, Footer } from '@/components';
import { Card, Button } from '@/components/ui';
import { useAuth } from '@/components/providers';
import { SKILLS } from '@/constants';
import {
  listPendingWorkers,
  setWorkerApproval,
  type ApiPendingWorker,
} from '@/lib/api';

function skillLabel(id: string): string {
  const match = SKILLS.find((skill) => skill.id === id);
  return match ? `${match.icon} ${match.label}` : id;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();

  const [workers, setWorkers] = useState<ApiPendingWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approvedCount, setApprovedCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPendingWorkers();
      setWorkers(data.workers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'List load nahi hui.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void load();
  }, [authLoading, user, load]);

  const decide = useCallback(
    async (worker: ApiPendingWorker, approved: boolean) => {
      setBusyId(worker.id);
      setError(null);
      try {
        await setWorkerApproval(worker.id, approved);
        if (approved) setApprovedCount((count) => count + 1);
        setWorkers((current) => current.filter((item) => item.id !== worker.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Approval fail ho gayi.');
      } finally {
        setBusyId(null);
      }
    },
    [],
  );
  return (
    <>
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck size={22} className="text-primary-dark" />
          <h1 className="text-2xl font-bold">Admin — Worker Approval</h1>
        </div>

        {authLoading || (user && loading) ? (
          <Card>
            <p className="text-text-secondary text-center py-8">Loading…</p>
          </Card>
        ) : !user ? (
          <Card>
            <div className="text-center space-y-4 py-4">
              <ShieldCheck size={40} className="text-primary-light mx-auto" />
              <h2 className="text-xl font-bold">Pehle login karo</h2>
              <Link href="/login">
                <Button>Login karo</Button>
              </Link>
            </div>
          </Card>
        ) : error && workers.length === 0 ? (
          <Card>
            <div className="text-center space-y-4 py-4">
              <XCircle size={40} className="text-danger mx-auto" />
              <h2 className="text-xl font-bold">Access nahi mila</h2>
              <p className="text-text-secondary">{error}</p>
              <p className="text-caption text-text-secondary">
                Admin banne ke liye apna number Render ke <code>ADMIN_PHONES</code> me daalo.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {error && (
              <p className="rounded-button bg-red-50 px-4 py-3 text-small text-danger" role="alert">
                {error}
              </p>
            )}

            {approvedCount > 0 && (
              <p className="rounded-button bg-green-50 px-4 py-3 text-small text-success">
                {approvedCount} worker approve ho gaye ✅
              </p>
            )}

            {workers.length === 0 ? (
              <Card>
                <div className="text-center space-y-3 py-6">
                  <CheckCircle2 size={36} className="text-success mx-auto" />
                  <p className="text-text-secondary">
                    Abhi koi worker approval ke liye pending nahi hai.
                  </p>
                </div>
              </Card>
            ) : (
              workers.map((worker) => (
                <Card key={worker.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{worker.user?.name ?? 'Kaarigar'}</h3>
                      <p className="text-small text-text-secondary">
                        {worker.user?.phone ? `+91 ${worker.user.phone}` : '—'}
                        {worker.user?.locationArea ? ` · ${worker.user.locationArea}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 px-2.5 py-1 rounded-full text-caption font-medium bg-warning text-gray-900">
                      Pending
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-small text-text-secondary">
                    <span>₹{worker.hourlyRate}/hr</span>
                    <span>{worker.experience} yrs exp</span>
                    <span>{new Date(worker.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {worker.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 bg-gray-100 text-text-secondary text-caption rounded-full"
                      >
                        {skillLabel(skill)}
                      </span>
                    ))}
                  </div>

                  {worker.description && (
                    <p className="text-small text-text-secondary mt-3">{worker.description}</p>
                  )}

                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Button size="sm" isLoading={busyId === worker.id} onClick={() => void decide(worker, true)}>
                      <CheckCircle2 size={15} className="mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      isLoading={busyId === worker.id}
                      onClick={() => void decide(worker, false)}
                    >
                      <XCircle size={15} className="mr-1" /> Reject
                    </Button>
                    <Link href={`/worker?id=${worker.id}`}>
                      <Button size="sm" variant="ghost">
                        Profile dekho
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}

