'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, Bell, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuth } from '@/components/providers';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🔧</span>
            <span className="text-xl font-bold text-primary-dark">
              SahiKaarigar
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/search"
              className="text-text-secondary hover:text-primary-dark transition-colors"
            >
              Search Workers
            </Link>
            <Link
              href="/search?skill=electrician"
              className="text-text-secondary hover:text-primary-dark transition-colors"
            >
              Electricians
            </Link>
            <Link
              href="/search?skill=plumber"
              className="text-text-secondary hover:text-primary-dark transition-colors"
            >
              Plumbers
            </Link>
            <Link
              href="/hires"
              className="text-text-secondary hover:text-primary-dark transition-colors"
            >
              My Requests
            </Link>
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* Notifications */}
                <button className="relative p-2 text-text-secondary hover:text-primary-dark transition-colors">
                  <Bell size={20} />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full" />
                </button>

                {/* User Menu */}
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 p-2 rounded-button hover:bg-gray-100 transition-colors"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center">
                      <User size={16} className="text-white" />
                    </div>
                  )}
                  <span className="hidden sm:block text-small font-medium">
                    {user.name}
                  </span>
                </Link>

                {/* Logout */}
                <button
                  type="button"
                  onClick={() => {
                    void logout();
                  }}
                  className="p-2 text-text-secondary hover:text-danger transition-colors"
                  aria-label="Logout"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </Link>
                <Link href="/register/employer">
                  <Button size="sm">
                    Register
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-text-secondary hover:text-primary-dark transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t animate-fade-in">
            <nav className="flex flex-col gap-3">
              <Link
                href="/search"
                className="px-4 py-2 text-text-secondary hover:text-primary-dark hover:bg-gray-50 rounded-button transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Search Workers
              </Link>
              <Link
                href="/search?skill=electrician"
                className="px-4 py-2 text-text-secondary hover:text-primary-dark hover:bg-gray-50 rounded-button transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Electricians
              </Link>
              <Link
                href="/search?skill=plumber"
                className="px-4 py-2 text-text-secondary hover:text-primary-dark hover:bg-gray-50 rounded-button transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Plumbers
              </Link>
              <Link
                href="/hires"
                className="px-4 py-2 text-text-secondary hover:text-primary-dark hover:bg-gray-50 rounded-button transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                My Requests
              </Link>
              {!user && (
                <div className="flex gap-2 px-4 pt-2">
                  <Link href="/login" className="flex-1">
                    <Button variant="secondary" fullWidth>
                      Login
                    </Button>
                  </Link>
                  <Link href="/register/employer" className="flex-1">
                    <Button fullWidth>
                      Register
                    </Button>
                  </Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}