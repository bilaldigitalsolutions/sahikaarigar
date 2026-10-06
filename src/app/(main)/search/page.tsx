'use client';

import { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Header, Footer, WorkerCard, Button, Input, WorkerCardSkeleton } from '@/components';
import { SKILLS, HYDERABAD_AREAS } from '@/constants';

// Mock data (would be fetched from API)
const MOCK_WORKERS = [
  {
    id: '1',
    user: {
      id: '1',
      name: 'Raj Kumar',
      avatar: '',
      locationArea: 'Ameerpet',
      locationCity: 'Hyderabad',
    },
    skills: ['electrician', 'wiring'],
    experience: 5,
    hourlyRate: 300,
    availability: 'available' as const,
    ratingAverage: 4.8,
    ratingCount: 45,
    completedJobs: 120,
  },
  {
    id: '2',
    user: {
      id: '2',
      name: 'Ahmed Ali',
      avatar: '',
      locationArea: 'Kukatpally',
      locationCity: 'Hyderabad',
    },
    skills: ['plumber', 'pipe fitting'],
    experience: 3,
    hourlyRate: 250,
    availability: 'available' as const,
    ratingAverage: 4.5,
    ratingCount: 23,
    completedJobs: 67,
  },
];

export default function SearchPage() {
  const [selectedSkill, setSelectedSkill] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [workers, setWorkers] = useState(MOCK_WORKERS);

  const handleSearch = () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
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

        {/* Worker List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <WorkerCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {workers.map((worker) => (
              <WorkerCard key={worker.id} worker={worker} />
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