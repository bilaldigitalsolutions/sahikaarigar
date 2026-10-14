'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Bell, User, LogOut, Leaf } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/components/providers';

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Find Workers', href: '/search' },
  { label: 'Categories', href: '/#categories' },
  { label: 'How It Works', href: '/#how-it-works' },
] as const;

// Primary call-to-action (was the "Become a Worker" nav link).
const REGISTER_HREF = '/register/worker';
const REGISTER_LABEL = 'Kaarigar Registration';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href.startsWith('/#')) return false;
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between lg:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white">
              <Leaf size={20} />
            </span>
            <span className="text-xl font-bold text-text-primary">SahiKaarigar</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  'relative text-small font-medium transition-colors',
                  isActive(link.href)
                    ? 'text-primary-dark'
                    : 'text-text-secondary hover:text-primary-dark'
                )}
              >
                {link.label}
                {isActive(link.href) && (
                  <span className="absolute -bottom-2 left-0 right-0 h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            ))}

            {/* Primary CTA — replaces the old "Become a Worker" nav link */}
            <Link
              href={REGISTER_HREF}
              className="rounded-full bg-primary px-5 py-2 text-small font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              {REGISTER_LABEL}
            </Link>
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* Notifications */}
                <button className="relative p-2 text-text-secondary transition-colors hover:text-primary-dark">
                  <Bell size={20} />
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger" />
                </button>

                {/* User Menu */}
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 rounded-full p-1 pr-3 transition-colors hover:bg-green-50"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light">
                      <User size={16} className="text-white" />
                    </span>
                  )}
                  <span className="hidden text-small font-medium sm:block">{user.name}</span>
                </Link>

                {/* Logout */}
                <button
                  type="button"
                  onClick={() => {
                    void logout();
                  }}
                  className="p-2 text-text-secondary transition-colors hover:text-danger"
                  aria-label="Logout"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </>
            ) : null}

            {/* Mobile Menu Button */}
            <button
              className="p-2 text-text-secondary transition-colors hover:text-primary-dark lg:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="animate-fade-in border-t py-4 lg:hidden">
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    'rounded-button px-4 py-2 transition-colors',
                    isActive(link.href)
                      ? 'bg-green-50 font-semibold text-primary-dark'
                      : 'text-text-secondary hover:bg-gray-50 hover:text-primary-dark'
                  )}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              {/* Primary CTA on mobile */}
              <Link
                href={REGISTER_HREF}
                className="mt-2 block rounded-full bg-primary py-2 text-center text-small font-semibold text-white"
                onClick={() => setIsMenuOpen(false)}
              >
                {REGISTER_LABEL}
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
