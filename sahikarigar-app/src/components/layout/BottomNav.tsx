'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, ClipboardList, User, ToggleLeft, ToggleRight, type LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface NavTab {
  label: string;
  href: string;
  icon: LucideIcon;
  isActive: boolean;
  onClick?: () => void;
}

interface BottomNavProps {
  role: 'worker' | 'employer' | null;
  isAvailable?: boolean;
  onToggleAvailability?: () => void;
}

export function BottomNav({ role, isAvailable, onToggleAvailability }: BottomNavProps) {
  const pathname = usePathname();

  // Worker navigation (3 tabs)
  const workerTabs: NavTab[] = [
    {
      label: 'Requests',
      href: '/dashboard',
      icon: ClipboardList,
      isActive: pathname === '/dashboard',
    },
    {
      label: isAvailable ? 'Available' : 'Busy',
      href: '#',
      icon: isAvailable ? ToggleRight : ToggleLeft,
      isActive: false,
      onClick: onToggleAvailability,
    },
    {
      label: 'Profile',
      href: '/profile',
      icon: User,
      isActive: pathname === '/profile',
    },
  ];

  // Employer navigation (4 tabs)
  const employerTabs: NavTab[] = [
    {
      label: 'Home',
      href: '/',
      icon: Home,
      isActive: pathname === '/',
    },
    {
      label: 'Search',
      href: '/search',
      icon: Search,
      isActive: pathname === '/search',
    },
    {
      label: 'My Hires',
      href: '/dashboard',
      icon: ClipboardList,
      isActive: pathname === '/dashboard',
    },
    {
      label: 'Profile',
      href: '/profile',
      icon: User,
      isActive: pathname === '/profile',
    },
  ];

  const tabs: NavTab[] = role === 'worker' ? workerTabs : employerTabs;

  // Don't show on admin pages
  if (pathname.startsWith('/admin')) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg md:hidden">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isToggle = tab.label === 'Available' || tab.label === 'Busy';

          if (isToggle && tab.onClick) {
            return (
              <button
                key={tab.label}
                onClick={tab.onClick}
                className={clsx(
                  'flex flex-col items-center justify-center w-full h-full gap-1 transition-colors',
                  isAvailable ? 'text-success' : 'text-text-secondary'
                )}
              >
                <Icon size={20} />
                <span className="text-caption font-medium">{tab.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                'flex flex-col items-center justify-center w-full h-full gap-1 transition-colors',
                tab.isActive ? 'text-primary-dark' : 'text-text-secondary'
              )}
            >
              <Icon size={20} />
              <span className="text-caption font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}