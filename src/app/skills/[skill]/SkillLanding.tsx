'use client';

// =============================================================================
// SkillLanding — the listing half of /skills/[skill]
// =============================================================================
// Resolves the skill from the URL slug, then shows every approved + available
// worker for that skill (same data the /search page uses).
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Header, Footer, WorkerCard, Button, WorkerCardSkeleton } from '@/components';
import { SKILLS } from '@/constants';
import { generateSlug } from '@/utils';
import { searchWorkers, type ApiWorker } from '@/lib/api';

export default function SkillLanding({ slug }: { slug: string }) {
  const skill = SKILLS.find((item) => generateSlug(item.id) === slug) ?? null;

  const [workers, setWorkers] = useState<ApiWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!skill) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await searchWorkers({ skill: skill.id });
      setWorkers(data.workers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workers load nahi hue. Dobara try karo.');
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, [skill]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <Header />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            {skill ? `${skill.icon} ${skill.label} in Hyderabad` : 'Workers'}
          </h1>
          <p className="text-text-secondary">
            {skill
              ? `Verified ${skill.label.toLowerCase()}s - ratings, reviews aur direct hire.`
              : 'Skill ke hisaab se workers.'}
          </p>
        </div>

        {/* Result count */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-text-secondary">
            {loading ? 'Dhoond rahe hain…' : `${workers.length} workers found`}
          </p>
          <Link href="/search" className="flex items-center gap-2 text-primary-dark hover:underline text-small">
            <Search size={16} />
            Advanced search
          </Link>
        </div>

        {error && (
          <p className="rounded-button bg-red-50 px-4 py-3 text-small text-danger mb-4" role="alert">
            {error}
          </p>
        )}

        {/* Results */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <WorkerCardSkeleton key={i} />
            ))}
          </div>
        ) : workers.length === 0 ? (
          <div className="rounded-card bg-white border border-gray-100 p-10 text-center">
            <p className="text-text-secondary mb-4">
              {skill
                ? `Abhi is skill ke koi ${skill.label.toLowerCase()} listed nahi hain.`
                : 'Abhi koi worker nahi mila.'}{' '}
              Jald hi aayenge!
            </p>
            <Link href="/search">
              <Button variant="secondary">Saare workers dikhao</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {workers.map((worker) => (
              <WorkerCard
                key={worker.id}
                worker={{
                  id: worker.id,
                  user: {
                    id: worker.user?.id ?? worker.id,
                    name: worker.user?.name ?? 'Kaarigar',
                    avatar: worker.user?.avatar ?? null,
                    locationArea: worker.user?.locationArea ?? null,
                    locationCity: worker.user?.locationCity ?? null,
                  },
                  skills: worker.skills,
                  experience: worker.experience,
                  hourlyRate: worker.hourlyRate,
                  availability: worker.availability,
                  ratingAverage: worker.ratingAverage,
                  ratingCount: worker.ratingCount,
                  completedJobs: worker.completedJobs,
                }}
              />
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-10 rounded-card bg-primary-dark text-white p-6 text-center">
          <h2 className="text-lg font-semibold mb-2">
            {skill ? `${skill.label} ho?` : 'Worker ho?'} Apna profile banao
          </h2>
          <p className="text-small opacity-90 mb-4">
            Free registration - admin approve karega, phir seedha kaam ke requests pao.
          </p>
          <Link href="/register/worker">
            <Button className="bg-white text-primary-dark hover:bg-gray-100">
              Register as {skill ? skill.label : 'Worker'}
            </Button>
          </Link>
        </div>
      </div>

      <Footer />
    </>
  );
}
