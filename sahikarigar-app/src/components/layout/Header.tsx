'use client';

import Link from 'next/link';
import { Leaf } from 'lucide-react';

// Legal-safe navigation: every href below is a REAL page in this app.
// (The old header linked /search, /register/*, /dashboard and /#anchors —
// none of which exist on this deployment, so a Play reviewer tapping
// "Privacy" or the nav got 404s. Keep this list in sync with src/app.)
const NAV_LINKS = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Delete Account', href: '/delete-account' },
  { label: 'Contact', href: '/contact' },
] as const;

export function Header() {
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
          <nav className="hidden items-center gap-6 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-small font-medium text-text-secondary transition-colors hover:text-primary-dark"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
