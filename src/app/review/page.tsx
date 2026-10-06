'use client';

// =============================================================================
// /review?hire=<hireRequestId> — after a job is done
// =============================================================================
// Two steps, both required:
//   1. Rate + review the WORKER      -> POST /reviews
//   2. Rate + feedback the PLATFORM  -> POST /feedback
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Star } from 'lucide-react';
import { Header, Footer } from '@/components';
import { Card, Button } from '@/components/ui';
import { useAuth } from '@/components/providers';
import { createReview, getHire, sendPlatformFeedback, type ApiHire, type ApiReview } from '@/lib/api';

function StarPicker({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
}) {
  return (
    <div>
      <p className="text-small font-medium mb-2">{label}</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            aria-label={`${star} star`}
            onClick={() => onChange(star)}
            className="p-0.5"
          >
            <Star
              size={30}
              className={star <= value ? 'text-warning fill-warning' : 'text-gray-300'}
            />
          </button>
        ))}
        <span className="ml-2 text-small text-text-secondary">{value}/5</span>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const { user, loading: authLoading } = useAuth();

  const [hireId, setHireId] = useState<string | null>(null);
  const [hire, setHire] = useState<ApiHire | null>(null);
  const [existingReview, setExistingReview] = useState<ApiReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [reviewSaved, setReviewSaved] = useState(false);

  const [platformRating, setPlatformRating] = useState(5);
  const [platformComment, setPlatformComment] = useState('');
  const [platformSaving, setPlatformSaving] = useState(false);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('hire');
    setHireId(id);
    if (!id) {
      setLoading(false);
      setError('Kis kaam ka review dena hai woh nahi mila.');
    }
  }, []);

  useEffect(() => {
    if (!hireId || authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const data = await getHire(hireId);
        if (cancelled) return;
        setHire(data.hire);
        setExistingReview(data.review);
        if (data.review) setReviewSaved(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Kaam load nahi hua.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hireId, authLoading, user]);

  const submitReview = useCallback(async () => {
    if (!hire) return;
    setSaving(true);
    setError(null);
    try {
      await createReview({ hireRequestId: hire.id, rating, comment: comment.trim() });
      setReviewSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review save nahi hua.');
    } finally {
      setSaving(false);
    }
  }, [hire, rating, comment]);

  const submitPlatform = useCallback(async () => {
    setPlatformSaving(true);
    setError(null);
    try {
      await sendPlatformFeedback({
        hireRequestId: hire?.id,
        rating: platformRating,
        comment: platformComment.trim(),
      });
      setAllDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Feedback save nahi hua.');
    } finally {
      setPlatformSaving(false);
    }
  }, [hire, platformRating, platformComment]);
  return (
    <>
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-10">
        {loading ? (
          <Card>
            <p className="text-text-secondary text-center py-8">Loading…</p>
          </Card>
        ) : !user ? (
          <Card>
            <div className="text-center space-y-4 py-4">
              <Star size={40} className="text-primary-light mx-auto" />
              <h1 className="text-xl font-bold">Pehle login karo</h1>
              <Link href="/login">
                <Button>Login karo</Button>
              </Link>
            </div>
          </Card>
        ) : !hire ? (
          <Card>
            <div className="text-center space-y-4 py-4">
              <h1 className="text-xl font-bold">Review nahi mila</h1>
              <p className="text-text-secondary">{error ?? 'Ye kaam available nahi hai.'}</p>
              <Link href="/hires">
                <Button>Meri requests</Button>
              </Link>
            </div>
          </Card>
        ) : allDone ? (
          <Card>
            <div className="text-center space-y-4 py-6">
              <CheckCircle2 size={44} className="text-success mx-auto" />
              <h1 className="text-xl font-bold">Shukriya! 🙏</h1>
              <p className="text-text-secondary">
                Aapka review aur feedback dono mil gaye. Isse doosre logon ko sahi kaarigar chunne
                me madad milegi.
              </p>
              <div className="flex gap-3 justify-center">
                <Link href="/hires">
                  <Button>Meri requests</Button>
                </Link>
                <Link href="/search">
                  <Button variant="secondary">Aur workers</Button>
                </Link>
              </div>
            </div>
          </Card>
        ) : hire.status !== 'completed' ? (
          <Card>
            <div className="text-center space-y-4 py-4">
              <h1 className="text-xl font-bold">Pehle kaam poora hona chahiye</h1>
              <p className="text-text-secondary">
                Review sirf tab diya ja sakta hai jab kaam complete ho jaye.
              </p>
              <Link href="/hires">
                <Button>Meri requests dekho</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Kaam kaisa raha?</h1>
              <p className="text-text-secondary text-small mt-1">
                {hire.worker?.user?.name ?? 'Kaarigar'} ke saath apna experience share karo.
              </p>
            </div>

            <Card>
              <p className="text-small text-text-secondary">{hire.description}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-caption text-text-secondary">
                <span>📍 {hire.location}</span>
                <span>₹{hire.proposedRate}/hr</span>
                <span>
                  {new Date(hire.completedAt ?? hire.createdAt).toLocaleDateString('en-IN')}
                </span>
              </div>
            </Card>
            {!reviewSaved ? (
              <Card>
                <h2 className="font-semibold mb-4">1. Kaarigar ko rate karo</h2>
                <StarPicker
                  value={rating}
                  onChange={setRating}
                  label={`${hire.worker?.user?.name ?? 'Kaarigar'} ko kitne star?`}
                />
                <textarea
                  rows={3}
                  maxLength={500}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Kaam kaisa tha? Time pe aaya? Recommend karoge?"
                  className="mt-4 w-full bg-gray-50 border-2 border-transparent rounded-button px-4 py-3 text-body focus:border-primary-dark focus:bg-white transition-all resize-none"
                />
                <Button
                  className="mt-4"
                  fullWidth
                  size="lg"
                  isLoading={saving}
                  onClick={() => void submitReview()}
                >
                  Review submit karo
                </Button>
              </Card>
            ) : (
              <Card>
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 size={20} />
                  <span className="font-medium">
                    Kaarigar ko {existingReview?.rating ?? rating} star de diye ✅
                  </span>
                </div>
              </Card>
            )}

            {reviewSaved && (
              <Card>
                <h2 className="font-semibold mb-4">2. SahiKaarigar ke baare me batao</h2>
                <StarPicker
                  value={platformRating}
                  onChange={setPlatformRating}
                  label="App kitna useful laga?"
                />
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={platformComment}
                  onChange={(event) => setPlatformComment(event.target.value)}
                  placeholder="Kya acha laga, kya sudharna chahiye?"
                  className="mt-4 w-full bg-gray-50 border-2 border-transparent rounded-button px-4 py-3 text-body focus:border-primary-dark focus:bg-white transition-all resize-none"
                />
                <Button
                  className="mt-4"
                  fullWidth
                  size="lg"
                  isLoading={platformSaving}
                  onClick={() => void submitPlatform()}
                >
                  Feedback bhejo
                </Button>
              </Card>
            )}

            {error && (
              <p className="rounded-button bg-red-50 px-4 py-3 text-small text-danger" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}


