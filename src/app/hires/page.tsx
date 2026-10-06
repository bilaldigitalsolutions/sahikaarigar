'use client';

// =============================================================================
// /hires — every request this user is part of, seen from both sides:
//   "Meri requests"      = jobs the user asked for (they are the hirer)
//   "Mujhe mili requests" = jobs offered to them (they are the worker)
// Live status: pending -> accepted -> on the way -> reached -> completed
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ClipboardList, Clock, MapPin, Navigation, Phone, Star, XCircle } from 'lucide-react';
import { Header, Footer } from '@/components';
import { Card, Button } from '@/components/ui';
import { useAuth } from '@/components/providers';
import { hireAction, listHires, type ApiHire, type HireAction, type HireStatus } from '@/lib/api';

const STATUS_META: Record<HireStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-warning text-gray-900' },
  accepted: { label: 'Accept ho gayi', className: 'bg-blue-600 text-white' },
  en_route: { label: 'Aaya ja raha hai 🚶', className: 'bg-blue-500 text-white' },
  arrived: { label: 'Pahunch gaya 📍', className: 'bg-success text-white' },
  completed: { label: 'Kaam poora ✅', className: 'bg-success text-white' },
  cancelled: { label: 'Cancel', className: 'bg-gray-400 text-white' },
  rejected: { label: 'Reject', className: 'bg-gray-400 text-white' },
};

function formatPhone(phone?: string | null): string {
  if (!phone) return '';
  return `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
}

export default function HiresPage() {
  const { user, loading: authLoading, refresh } = useAuth();

  const [hires, setHires] = useState<{ asEmployer: ApiHire[]; asWorker: ApiHire[] }>({
    asEmployer: [],
    asWorker: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listHires();
      setHires({ asEmployer: data.asEmployer, asWorker: data.asWorker });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Requests load nahi hui.');
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

  const act = useCallback(
    async (hire: ApiHire, action: HireAction) => {
      setBusyId(hire.id);
      setError(null);
      try {
        // When the worker says "I'm on my way", share the phone's location.
        let coords: { lat?: number; lng?: number } | undefined;
        if (action === 'en_route' || action === 'arrived') {
          const { getBrowserLocation } = await import('@/lib/api');
          coords = await getBrowserLocation();
        }
        await hireAction(hire.id, action, coords);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action fail ho gaya.');
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const total = hires.asEmployer.length + hires.asWorker.length;
function HireCard({
  hire,
  side,
  onAction,
  busy,
}: {
  hire: ApiHire;
  side: 'employer' | 'worker';
  onAction: (hire: ApiHire, action: HireAction) => void;
  busy: boolean;
}) {
  const meta = STATUS_META[hire.status];
  const other = side === 'employer' ? hire.worker?.user : hire.employer;
  const otherName = other?.name ?? (side === 'employer' ? 'Kaarigar' : 'User');
  const contactPhone = other?.phone ?? null;
  const canTrack = hire.status === 'en_route' || hire.status === 'arrived';
  const mapUrl =
    hire.workerLat != null && hire.workerLng != null
      ? `https://www.google.com/maps?q=${hire.workerLat},${hire.workerLng}`
      : null;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption text-text-secondary">
            {side === 'employer' ? 'Kaarigar' : 'Aapko request bheji'}
          </p>
          <h3 className="font-semibold truncate">{otherName}</h3>
        </div>
        <span className={`shrink-0 px-2.5 py-1 rounded-full text-caption font-medium ${meta.className}`}>
          {meta.label}
        </span>
      </div>

      <p className="text-body mt-3">{hire.description}</p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-small text-text-secondary">
        <span className="flex items-center gap-1">
          <MapPin size={14} /> {hire.location}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={14} /> ₹{hire.proposedRate}/hr
        </span>
        <span>{new Date(hire.createdAt).toLocaleDateString('en-IN')}</span>
      </div>

      {/* Contact — only once the worker has accepted */}
      {contactPhone && ['accepted', 'en_route', 'arrived', 'completed'].includes(hire.status) && (
        <a
          href={`tel:+91${contactPhone}`}
          className="inline-flex items-center gap-1.5 mt-3 text-small font-medium text-primary-dark hover:underline"
        >
          <Phone size={14} /> {formatPhone(contactPhone)}
        </a>
      )}

      {canTrack && mapUrl && (
        <a
          href={mapUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 mt-2 ml-3 text-small text-blue-600 hover:underline"
        >
          <Navigation size={14} /> Live location dekho
        </a>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
        {side === 'worker' && hire.status === 'pending' && (
          <>
            <Button size="sm" isLoading={busy} onClick={() => onAction(hire, 'accept')}>
              <CheckCircle2 size={15} className="mr-1" /> Accept
            </Button>
            <Button size="sm" variant="secondary" isLoading={busy} onClick={() => onAction(hire, 'reject')}>
              <XCircle size={15} className="mr-1" /> Reject
            </Button>
          </>
        )}

        {side === 'worker' && (hire.status === 'accepted' || hire.status === 'en_route') && (
          <Button size="sm" isLoading={busy} onClick={() => onAction(hire, 'en_route')}>
            <Navigation size={15} className="mr-1" /> Aaya ja raha hoon
          </Button>
        )}

        {side === 'worker' && (hire.status === 'accepted' || hire.status === 'en_route' || hire.status === 'arrived') && (
          <>
            <Button size="sm" isLoading={busy} onClick={() => onAction(hire, 'arrived')}>
              <MapPin size={15} className="mr-1" /> Pahunch gaya
            </Button>
            <Button size="sm" variant="secondary" isLoading={busy} onClick={() => onAction(hire, 'complete')}>
              Kaam poora
            </Button>
          </>
        )}

        {side === 'employer' && ['accepted', 'en_route', 'arrived'].includes(hire.status) && (
          <>
            <Button size="sm" isLoading={busy} onClick={() => onAction(hire, 'complete')}>
              <CheckCircle2 size={15} className="mr-1" /> Kaam poora hua
            </Button>
            <Button size="sm" variant="secondary" isLoading={busy} onClick={() => onAction(hire, 'cancel')}>
              Cancel
            </Button>
          </>
        )}

        {side === 'employer' && hire.status === 'pending' && (
          <Button size="sm" variant="secondary" isLoading={busy} onClick={() => onAction(hire, 'cancel')}>
            Cancel
          </Button>
        )}

        {side === 'employer' && hire.status === 'completed' && (
          <Link href={`/review?hire=${hire.id}`}>
            <Button size="sm">
              <Star size={15} className="mr-1" /> Review do
            </Button>
          </Link>
        )}
      </div>
    </Card>
  );
}
  return (
    <>
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Meri Requests</h1>
          <p className="text-text-secondary text-small">
            Live status — kaun aa raha hai, pahuncha ya nahi.
          </p>
        </div>

        {authLoading || (user && loading) ? (
          <Card>
            <p className="text-text-secondary text-center py-8">Loading…</p>
          </Card>
        ) : !user ? (
          <Card>
            <div className="text-center space-y-4 py-4">
              <ClipboardList size={40} className="text-primary-light mx-auto" />
              <h2 className="text-xl font-bold">Pehle mobile verify karo</h2>
              <p className="text-text-secondary">
                Requests dekhne ke liye apna number verify karo — koi registration nahi.
              </p>
              <Link href="/login">
                <Button>Login karo</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-8">
            {error && (
              <p className="rounded-button bg-red-50 px-4 py-3 text-small text-danger" role="alert">
                {error}
              </p>
            )}

            {total === 0 && (
              <Card>
                <div className="text-center space-y-3 py-4">
                  <ClipboardList size={36} className="text-gray-300 mx-auto" />
                  <p className="text-text-secondary">Abhi koi request nahi hai.</p>
                  <Link href="/search">
                    <Button>Workers dhoondo</Button>
                  </Link>
                </div>
              </Card>
            )}

            {hires.asEmployer.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3">
                  Meri requests ({hires.asEmployer.length})
                </h2>
                <div className="space-y-4">
                  {hires.asEmployer.map((hire) => (
                    <HireCard
                      key={hire.id}
                      hire={hire}
                      side="employer"
                      onAction={act}
                      busy={busyId === hire.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {hires.asWorker.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3">
                  Mujhe mili requests ({hires.asWorker.length})
                </h2>
                <div className="space-y-4">
                  {hires.asWorker.map((hire) => (
                    <HireCard
                      key={hire.id}
                      hire={hire}
                      side="worker"
                      onAction={act}
                      busy={busyId === hire.id}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}


