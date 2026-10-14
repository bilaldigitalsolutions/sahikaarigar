import Link from 'next/link';
import { Star, MapPin, Phone, MessageCircle, BadgeCheck } from 'lucide-react';
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

const AVAILABILITY_STYLES = {
  available: 'bg-green-100 text-primary-dark',
  busy: 'bg-amber-100 text-amber-700',
  offline: 'bg-gray-100 text-gray-600',
} as const;

const AVAILABILITY_LABELS = {
  available: 'Available',
  busy: 'Busy',
  offline: 'Offline',
} as const;

function capitalize(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((index) => (
        <Star
          key={index}
          size={14}
          className={index <= Math.round(value) ? 'fill-warning text-warning' : 'text-gray-300'}
        />
      ))}
    </span>
  );
}

export function WorkerCard({ worker, onHire, showContact = false }: WorkerCardProps) {
  const { user, skills, hourlyRate, availability, ratingAverage, ratingCount } = worker;

  const primarySkill = skills[0] ? capitalize(skills[0]) : 'Kaarigar';
  const location = user.locationCity || user.locationArea || 'Hyderabad';
  const profileHref = `/worker?id=${worker.id}`;

  return (
    <Card
      variant="hover"
      padding="none"
      className="flex flex-col overflow-hidden border border-gray-100"
    >
      <div className="relative flex flex-col items-center px-5 pt-7 pb-5">
        {/* Availability */}
        <span
          className={`absolute left-4 top-4 rounded-full px-3 py-1 text-caption font-medium ${AVAILABILITY_STYLES[availability]}`}
        >
          {AVAILABILITY_LABELS[availability]}
        </span>

        {/* Verified */}
        <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-caption font-semibold text-primary-dark">
          <BadgeCheck size={14} /> Verified
        </span>

        {/* Avatar */}
        <Link href={profileHref} aria-label={user.name}>
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="h-24 w-24 rounded-2xl object-cover"
            />
          ) : (
            <span className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary-light text-2xl font-bold text-white">
              {getInitials(user.name)}
            </span>
          )}
        </Link>

        {/* Name */}
        <Link
          href={profileHref}
          className="mt-3 text-body font-semibold text-text-primary transition-colors hover:text-primary-dark"
        >
          {user.name}
        </Link>

        {/* Rating */}
        <div className="mt-1 flex items-center gap-1.5">
          {ratingCount > 0 ? (
            <>
              <Stars value={ratingAverage} />
              <span className="text-small font-medium">{ratingAverage.toFixed(1)}</span>
              <span className="text-caption text-text-secondary">({ratingCount} reviews)</span>
            </>
          ) : (
            <span className="text-caption text-text-secondary">New worker</span>
          )}
        </div>

        {/* Skill & location */}
        <div className="mt-2 flex items-center gap-1 text-text-secondary">
          <MapPin size={14} className="shrink-0 text-primary" />
          <span className="text-small">
            {primarySkill} • {location}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-4">
        <span className="text-body font-bold text-text-primary">
          {formatCurrency(hourlyRate)}
          <span className="text-small font-normal text-text-secondary">/hr</span>
        </span>

        <div className="flex items-center gap-2">
          {showContact && (
            <>
              <Button variant="ghost" size="sm" aria-label="Call">
                <Phone size={16} />
              </Button>
              <Button variant="ghost" size="sm" aria-label="WhatsApp">
                <MessageCircle size={16} />
              </Button>
            </>
          )}

          {onHire && availability === 'available' ? (
            <Button size="sm" onClick={() => onHire(worker.id)}>
              Hire
            </Button>
          ) : (
            <Link href={profileHref}>
              <Button size="sm">Hire</Button>
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
