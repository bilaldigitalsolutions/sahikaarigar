'use client';

// =============================================================================
// FeaturedWorkers — the "Top Rated Workers" strip on the home page.
// =============================================================================
// Client component so the static home page can pull live data from the
// auth-server at runtime (a static export has no server to fetch at build time).
// =============================================================================

import { useEffect, useState } from 'react';
import { WorkerCard } from './WorkerCard';
import { WorkerCardSkeleton } from '@/components/ui';
import { searchWorkers, type ApiWorker } from '@/lib/api';

const GRID = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';

export function FeaturedWorkers({ limit = 3 }: { limit?: number }) {
  const [workers, setWorkers] = useState<ApiWorker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await searchWorkers({ limit });
        if (!cancelled) setWorkers(data.workers);
      } catch {
        if (!cancelled) setWorkers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [limit]);

  if (loading) {
    return (
      <div className={GRID}>
        {Array.from({ length: limit }).map((_, index) => (
          <WorkerCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (workers.length === 0) {
    return (
      <p className="text-text-secondary text-center py-8">
        Abhi koi kaarigar listed nahi hai. Jald hi aayenge!
      </p>
    );
  }

  return (
    <div className={GRID}>
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
  );
}
