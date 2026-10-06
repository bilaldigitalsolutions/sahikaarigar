import Link from 'next/link';
import { Star, MapPin, Phone, MessageCircle } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { formatCurrency, getInitials } from '@/utils';

interface WorkerCardProps {
  worker: {
    id: string;
    user: {
      id: string;
      name: string;
      avatar?: string | null;
      locationArea?: string | null;
      locationCity?: string | null;
    };
    skills: string[];
    experience: number;
    hourlyRate: number;
    availability: 'available' | 'busy' | 'offline';
    ratingAverage: number;
    ratingCount: number;
    completedJobs: number;
  };
  onHire?: (workerId: string) => void;
  showContact?: boolean;
}

export function WorkerCard({ worker, onHire, showContact = false }: WorkerCardProps) {
  const { user, skills, experience, hourlyRate, availability, ratingAverage, ratingCount } = worker;

  const availabilityColors = {
    available: 'bg-success text-white',
    busy: 'bg-warning text-gray-900',
    offline: 'bg-gray-400 text-white',
  };

  const availabilityLabels = {
    available: 'Available',
    busy: 'Busy',
    offline: 'Offline',
  };

  return (
    <Card variant="hover" padding="md">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <Link href={`/worker?id=${worker.id}`}>
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center">
              <span className="text-xl font-bold text-white">
                {getInitials(user.name)}
              </span>
            </div>
          )}
        </Link>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Link
                href={`/worker?id=${worker.id}`}
                className="text-body font-semibold text-text-primary hover:text-primary-dark transition-colors"
              >
                {user.name}
              </Link>
              <div className="flex items-center gap-2 mt-1">
                {ratingCount > 0 && (
                  <div className="flex items-center gap-1">
                    <Star size={14} className="text-warning fill-warning" />
                    <span className="text-small font-medium">
                      {ratingAverage.toFixed(1)}
                    </span>
                    <span className="text-caption text-text-secondary">
                      ({ratingCount})
                    </span>
                  </div>
                )}
                {user.locationArea && (
                  <div className="flex items-center gap-1 text-text-secondary">
                    <MapPin size={12} />
                    <span className="text-caption">{user.locationArea}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Availability Badge */}
            <span
              className={`px-2 py-1 rounded-full text-caption font-medium ${availabilityColors[availability]}`}
            >
              {availabilityLabels[availability]}
            </span>
          </div>

          {/* Skills */}
          <div className="flex flex-wrap gap-2 mt-2">
            {skills.slice(0, 3).map((skill) => (
              <span
                key={skill}
                className="px-2 py-1 bg-gray-100 text-text-secondary text-caption rounded-full capitalize"
              >
                {skill}
              </span>
            ))}
            {skills.length > 3 && (
              <span className="px-2 py-1 text-text-secondary text-caption">
                +{skills.length - 3} more
              </span>
            )}
          </div>

          {/* Rate & Experience */}
          <div className="flex items-center gap-4 mt-2 text-small text-text-secondary">
            <span>{formatCurrency(hourlyRate)}/hr</span>
            <span>•</span>
            <span>{experience} yrs exp</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t">
        {showContact && (
          <>
            <Button variant="ghost" size="sm" className="flex-1">
              <Phone size={16} className="mr-2" />
              Call
            </Button>
            <Button variant="ghost" size="sm" className="flex-1">
              <MessageCircle size={16} className="mr-2" />
              WhatsApp
            </Button>
          </>
        )}
        {onHire && availability === 'available' && (
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onHire(worker.id)}
          >
            Hire Now
          </Button>
        )}
        <Link href={`/worker?id=${worker.id}`} className="flex-1">
          <Button variant="secondary" size="sm" fullWidth>
            View Profile
          </Button>
        </Link>
      </div>
    </Card>
  );
}