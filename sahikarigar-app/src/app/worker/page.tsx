'use client';

// =============================================================================
// /worker?id=<workerProfileId> — public worker profile + "Hire karo" flow
// =============================================================================
// A query param (not /worker/[id]) because the site is a static export — there
// is no server to render unknown ids at request time.
//
// Hire flow: click Hire -> (OTP verify if not signed in) -> fill details ->
// POST /hires. The OTP step is what creates/identifies the user, so the user
// never has to "register".
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  MapPin,
  Phone,
  Star,
  Wrench,
} from 'lucide-react';
import { Header, Footer, SuperTokensPhonePanel } from '@/components';
import { Card, Button, Input } from '@/components/ui';
import { useAuth } from '@/components/providers';
import { SKILLS } from '@/constants';
import {
  createHire,
  getBrowserLocation,
  getWorker,
  type ApiReview,
  type ApiWorker,
} from '@/lib/api';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function skillLabel(id: string): string {
  const match = SKILLS.find((skill) => skill.id === id);
  return match ? `${match.icon} ${match.label}` : id;
}

export default function WorkerDetailPage() {
  const { user, refresh } = useAuth();

  const [workerId, setWorkerId] = useState<string | null>(null);
  const [worker, setWorker] = useState<ApiWorker | null>(null);
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hire form
  const [hiring, setHiring] = useState(false);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [rate, setRate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    setWorkerId(id);
    if (!id) {
      setLoading(false);
      setError('Kaarigar ki id nahi mili.');
    }
  }, []);

  useEffect(() => {
    if (!workerId) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await getWorker(workerId);
        if (cancelled) return;
        setWorker(data.worker);
        setReviews(data.reviews ?? []);
        setRate(String(data.worker.hourlyRate));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Kaarigar load nahi hua.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workerId]);

  useEffect(() => {
    if (user?.locationArea && !location) setLocation(user.locationArea);
  }, [user, location]);

  const submitHire = useCallback(async () => {
    if (!worker) return;
    setFormError(null);

    if (description.trim().length < 10) {
      setFormError('Kaam ki detail kam se kam 10 letter likho.');
      return;
    }
    if (location.trim().length < 3) {
      setFormError('Kaam ki jagah (area) likho.');
      return;
    }

    setSubmitting(true);
    try {
      await createHire({
        workerId: worker.id,
        description: description.trim(),
        location: location.trim(),
        proposedRate: Number(rate) || worker.hourlyRate,
        name: user?.name,
      });
      setDone(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Request nahi gayi. Dobara try karo.');
    } finally {
      setSubmitting(false);
    }
  }, [worker, description, location, rate, user]);

  const useMyLocation = useCallback(async () => {
    const coords = await getBrowserLocation();
    if (coords.lat && coords.lng) {
      setLocation((current) =>
        current.trim() ? current : `GPS ${coords.lat!.toFixed(4)}, ${coords.lng!.toFixed(4)}`,
      );
    }
  }, []);
  return (
    <>
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link
          href="/search"
          className="inline-flex items-center gap-1 text-small text-text-secondary hover:text-primary-dark mb-6"
        >
          <ArrowLeft size={16} /> Search pe wapas
        </Link>

        {loading ? (
          <Card>
            <p className="text-text-secondary text-center py-8">Loading…</p>
          </Card>
        ) : !worker ? (
          <Card>
            <div className="text-center space-y-4 py-6">
              <Wrench size={36} className="text-primary-light mx-auto" />
              <h1 className="text-xl font-bold">Kaarigar nahi mila</h1>
              <p className="text-text-secondary">{error ?? 'Ye profile available nahi hai.'}</p>
              <Link href="/search">
                <Button>Doosre workers dhoondo</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* ---------------- Profile ---------------- */}
            <Card>
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center shrink-0">
                  <span className="text-xl font-bold text-white">
                    {initials(worker.user?.name ?? 'W')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold truncate">{worker.user?.name ?? 'Kaarigar'}</h1>
                    {worker.user?.isVerified && <BadgeCheck size={18} className="text-success" />}
                    <span
                      className={`px-2 py-0.5 rounded-full text-caption font-medium ${
                        worker.availability === 'available'
                          ? 'bg-success text-white'
                          : worker.availability === 'busy'
                            ? 'bg-warning text-gray-900'
                            : 'bg-gray-400 text-white'
                      }`}
                    >
                      {worker.availability}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-small text-text-secondary">
                    {worker.ratingCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Star size={14} className="text-warning fill-warning" />
                        {worker.ratingAverage.toFixed(1)} ({worker.ratingCount})
                      </span>
                    )}
                    {worker.user?.locationArea && (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} /> {worker.user.locationArea}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t text-center">
                <div>
                  <p className="text-lg font-bold text-primary-dark">₹{worker.hourlyRate}</p>
                  <p className="text-caption text-text-secondary">per ghanta</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{worker.experience}</p>
                  <p className="text-caption text-text-secondary">saal experience</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{worker.completedJobs}</p>
                  <p className="text-caption text-text-secondary">kaam poore</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-5">
                {worker.skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-2.5 py-1 bg-gray-100 text-text-secondary text-caption rounded-full"
                  >
                    {skillLabel(skill)}
                  </span>
                ))}
              </div>

              {worker.description && (
                <p className="mt-5 text-body text-text-secondary">{worker.description}</p>
              )}

              {worker.serviceAreas.length > 0 && (
                <div className="mt-5">
                  <p className="text-small font-medium mb-2">Kaam ke areas</p>
                  <div className="flex flex-wrap gap-2">
                    {worker.serviceAreas.map((area) => (
                      <span
                        key={area}
                        className="px-2 py-0.5 bg-primary-light/10 text-primary-dark text-caption rounded-full capitalize"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
            {/* ---------------- Hire ---------------- */}
            <Card>
              {done ? (
                <div className="text-center space-y-3 py-2">
                  <CheckCircle2 size={36} className="text-success mx-auto" />
                  <h2 className="font-semibold">Request bhej di gayi!</h2>
                  <p className="text-small text-text-secondary">
                    Kaarigar accept karega to aapko status dikhega.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Link href="/hires">
                      <Button>Meri requests dekho</Button>
                    </Link>
                    <Link href="/search">
                      <Button variant="secondary">Aur workers</Button>
                    </Link>
                  </div>
                </div>
              ) : !hiring ? (
                <div className="text-center space-y-3">
                  <h2 className="font-semibold">Is kaarigar ko hire karo</h2>
                  <p className="text-small text-text-secondary">
                    Mobile number verify karke request bhejo — koi registration nahi.
                  </p>
                  <Button
                    size="lg"
                    disabled={worker.availability !== 'available'}
                    onClick={() => setHiring(true)}
                  >
                    {worker.availability === 'available' ? 'Hire karo' : 'Abhi available nahi'}
                  </Button>
                </div>
              ) : !user ? (
                <div className="space-y-4">
                  <div className="rounded-card bg-blue-50 px-4 py-3 text-small">
                    Pehle apna mobile verify karo — isi se kaarigar aapse baat kar payega.
                  </div>
                  <SuperTokensPhonePanel
                    ctaLabel="Verify karke aage badho"
                    onVerified={async () => {
                      await refresh();
                    }}
                  />
                </div>
              ) : (
                <form
                  className="space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitHire();
                  }}
                >
                  <Input
                    label="Kaam kya karna hai?"
                    placeholder="Jaise: Ghar me 3 fan lagane hain"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={1000}
                  />
                  <Input
                    label="Kahan (area / address)"
                    placeholder="Jaise: Ameerpet, Hyderabad"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    maxLength={200}
                  />
                  <button
                    type="button"
                    onClick={() => void useMyLocation()}
                    className="text-small text-primary-dark hover:underline flex items-center gap-1"
                  >
                    <MapPin size={14} /> Meri location use karo
                  </button>
                  <Input
                    label="Rate per ghanta (Rs.)"
                    type="number"
                    inputMode="numeric"
                    value={rate}
                    onChange={(event) => setRate(event.target.value)}
                  />

                  {formError && (
                    <p
                      className="rounded-button bg-red-50 px-4 py-3 text-small text-danger"
                      role="alert"
                    >
                      {formError}
                    </p>
                  )}

                  <div className="flex gap-3">
                    <Button type="submit" fullWidth size="lg" isLoading={submitting}>
                      Request bhejo
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setHiring(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </Card>
            {/* ---------------- Reviews ---------------- */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">
                  Reviews {worker.ratingCount > 0 && `(${worker.ratingCount})`}
                </h2>
                {worker.ratingCount > 0 && (
                  <span className="flex items-center gap-1 text-small">
                    <Star size={14} className="text-warning fill-warning" />
                    {worker.ratingAverage.toFixed(1)}
                  </span>
                )}
              </div>

              {reviews.length === 0 ? (
                <p className="text-small text-text-secondary">
                  Abhi koi review nahi hai. Pehla kaam aap karwao! 😊
                </p>
              ) : (
                <ul className="space-y-4">
                  {reviews.map((review) => (
                    <li key={review.id} className="border-b last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <Star
                              key={index}
                              size={13}
                              className={
                                index < review.rating
                                  ? 'text-warning fill-warning'
                                  : 'text-gray-300'
                              }
                            />
                          ))}
                        </span>
                        <span className="text-small font-medium">
                          {review.reviewer?.name ?? 'User'}
                        </span>
                        <span className="text-caption text-text-secondary">
                          {new Date(review.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-small text-text-secondary mt-1">{review.comment}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}



