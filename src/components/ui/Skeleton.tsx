import { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  lines = 1,
  ...props
}: SkeletonProps) {
  const baseStyles = 'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:400px_100%] animate-shimmer';

  const variants = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded',
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className={clsx('space-y-2', className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={clsx(
              baseStyles,
              variants.text,
              i === lines - 1 && 'w-3/4' // Last line is shorter
            )}
            style={{ width: i === lines - 1 ? '75%' : width }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={clsx(baseStyles, variants[variant], className)}
      style={{ width, height }}
      {...props}
    />
  );
}

// Worker Card Skeleton
export function WorkerCardSkeleton() {
  return (
    <div className="card p-4">
      <div className="flex items-start gap-4">
        <Skeleton variant="circular" width={64} height={64} />
        <div className="flex-1">
          <Skeleton width="60%" height={20} className="mb-2" />
          <Skeleton width="40%" height={16} className="mb-2" />
          <Skeleton width="30%" height={16} />
        </div>
      </div>
      <div className="mt-4">
        <Skeleton variant="text" lines={2} />
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton width={80} height={32} className="rounded-button" />
        <Skeleton width={80} height={32} className="rounded-button" />
      </div>
    </div>
  );
}

// Search Results Skeleton
export function SearchResultsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <WorkerCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Profile Skeleton
export function ProfileSkeleton() {
  return (
    <div className="card p-6">
      <div className="flex flex-col items-center">
        <Skeleton variant="circular" width={96} height={96} className="mb-4" />
        <Skeleton width="50%" height={24} className="mb-2" />
        <Skeleton width="30%" height={16} />
      </div>
      <div className="mt-6 space-y-3">
        <Skeleton variant="text" lines={3} />
      </div>
    </div>
  );
}