'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

const LINKS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/workers', label: 'Worker verification' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/hires', label: 'Hire requests' },
] as const;

export function AdminNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin pages" className="mb-6 flex flex-wrap gap-2">
      {LINKS.map(({ href, label }) => {
        const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'rounded-full border px-4 py-2 text-small font-medium',
              active
                ? 'border-primary-dark bg-primary-dark text-white'
                : 'border-gray-200 bg-white text-text-secondary hover:border-primary-dark hover:text-primary-dark',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
