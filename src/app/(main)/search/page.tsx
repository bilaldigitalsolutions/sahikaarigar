'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Header, Footer, WorkerCard, Button, WorkerCardSkeleton } from '@/components';
import { SKILLS, HYDERABAD_AREAS } from '@/constants';
import { searchWorkers, type ApiWorker } from '@/lib/api';

export default function SearchPage() {
  const [selectedSkill, setSelectedSkill] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [workers, setWorkers] = useState<ApiWorker[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (skill: string, area: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await searchWorkers({ skill: skill || undefined, area: area || undefined });
      setWorkers(data.workers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workers load nahi hue. Dobara try karo.');
      setWorkers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // First paint: honour ?skill= / ?area= from the URL (Header/Footer links),
  // otherwise show every approved + available worker.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const skill = params.get('skill') ?? '';
    const area = params.get('area') ?? '';
    setSelectedSkill(skill);
    setSelectedArea(area);
    void load(skill, area);
  }, [load]);

  const handleSearch = () => {
    void load(selectedSkill, selectedArea);
  };

  return (
    <>
      <Header />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-4">Search Workers</h1>
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              className="flex-1 px-4 py-3 rounded-button border-2 border-gray-200 text-body focus:border-primary-dark"
            >
              <option value="">All Skills</option>
              {SKILLS.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.icon} {skill.label}
                </option>
              ))}
            </select>
            
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="flex-1 px-4 py-3 rounded-button border-2 border-gray-200 text-body focus:border-primary-dark"
            >
              <option value="">All Areas</option>
              {HYDERABAD_AREAS.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.label}
                </option>
              ))}
            </select>
            
            <Button onClick={handleSearch} isLoading={isLoading}>
              <Search size={20} className="mr-2" />
              Search
            </Button>
          </div>
        </div>

        {/* Results */}
        <div className="mb-4">
          <p className="text-text-secondary">
            {workers.length} workers found
          </p>
        </div>

        {error && (
          <p className="rounded-button bg-red-50 px-4 py-3 text-small text-danger mb-4" role="alert">
            {error}
          </p>
        )}

        {/* Worker List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <WorkerCardSkeleton key={i} />
            ))}
          </div>
        ) : workers.length === 0 ? (
          <div className="rounded-card bg-white border border-gray-100 p-10 text-center">
            <p className="text-text-secondary mb-4">
              Is filter pe koi kaarigar nahi mila. Doosra skill ya area try karo.
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedSkill('');
                setSelectedArea('');
                void load('', '');
              }}
            >
              Saare workers dikhao
            </Button>
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

        {/* Load More */}
        {!isLoading && workers.length > 0 && (
          <div className="mt-8 text-center">
            <Button variant="secondary" onClick={() => {}}>
              Load More
            </Button>
          </div>
        )}
      </div>

      <Footer />
    </>
  );
}