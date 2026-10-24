'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  ChevronRight,
  ClipboardList,
  Flag,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { adminLogout, getAdminEmail, getAdminStats } from '@/lib/api';

const NAV_LINKS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, badgeKey: null as null },
  { href: '/admin/workers', label: 'Worker Verification', icon: UserCheck, badgeKey: 'verification' as const },
  { href: '/admin/users', label: 'Users', icon: Users, badgeKey: null as null },
  { href: '/admin/hires', label: 'Hire Requests', icon: ClipboardList, badgeKey: 'hires' as const },
  { href: '/admin/reports', label: 'User Reports', icon: Flag, badgeKey: null as null },
] as const;

function getInitials(nameOrEmail: string): string {
  const base = nameOrEmail.split('@')[0].replace(/[._-]+/g, ' ').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return 'AM';
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [verificationCount, setVerificationCount] = useState<number | null>(null);
  const [hireCount, setHireCount] = useState<number | null>(null);

  useEffect(() => {
    setSidebarOpen(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
    // Only the non-secret admin email is stored locally; the session itself is
    // an HttpOnly cookie the client cannot read.
    setEmail(getAdminEmail());
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadBadges = async () => {
      try {
        const data = await getAdminStats();
        if (cancelled) return;
        setVerificationCount(data.stats.pendingVerifications);
        setHireCount(data.stats.totalHires);
      } catch {
        // Real data only — leave badges hidden when the API fails.
        if (!cancelled) {
          setVerificationCount(null);
          setHireCount(null);
        }
      }
    };

    void loadBadges();

    // Poll so "Worker Verification" and the bell light up as soon as a new
    // Kaarigar registers, on any admin page. Paused while the tab is hidden.
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void loadBadges();
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const isActive = (href: string) =>
    href === '/admin' ? pathname === href : pathname.startsWith(href);

  const activeLabel =
    [...NAV_LINKS].reverse().find(({ href }) =>
      href === '/admin' ? pathname === href : pathname.startsWith(href),
    )?.label ?? 'Dashboard';

  const badgeFor = (key: 'verification' | 'hires' | null): number | null =>
    key === 'verification' ? verificationCount : key === 'hires' ? hireCount : null;

  const displayName = email ? email.split('@')[0].replace(/[._-]+/g, ' ') : 'Aarav Mehta';
  const initials = email ? getInitials(email) : 'AM';

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      // adminLogout() never throws: it clears the local session in a finally
      // block even when the backend is asleep or unreachable.
      await adminLogout();
    } finally {
      // Always leave the panel. `location.replace` avoids leaving the admin
      // page in the back-button history.
      window.location.replace('/admin');
    }
  };
  return (
    <div className="flex min-h-screen bg-[#F9FAFB] text-[#111827]">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-[264px] flex-col border-r border-gray-100 bg-white transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-3 px-5 pb-5 pt-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#10B981] text-white">
            <ShieldCheck size={22} strokeWidth={2.2} />
          </span>
          <span>
            <span className="block text-[19px] font-extrabold leading-tight tracking-tight">SahiAdmin</span>
            <span className="block text-[11px] font-semibold tracking-[0.08em] text-gray-400">
              VERIFIED PLATFORM
            </span>
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <p className="px-2 pb-2 pt-2 text-[12px] font-semibold tracking-[0.12em] text-gray-400">
            PLATFORM
          </p>
          <nav className="space-y-1.5">
            {NAV_LINKS.map(({ href, label, icon: Icon, badgeKey }) => {
              const active = isActive(href);
              const badge = badgeFor(badgeKey);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => {
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setSidebarOpen(false);
                    }
                  }}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                    active
                      ? 'bg-[#10B981] font-semibold text-white'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-[#111827]'
                  }`}
                >
                  <Icon size={19} strokeWidth={active ? 2.2 : 1.9} />
                  <span className="flex-1">{label}</span>
                  {badge !== null && badge !== undefined && badge > 0 && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                        active
                          ? 'bg-white/25 text-white'
                          : badgeKey === 'verification'
                            ? 'bg-red-50 text-red-600 ring-1 ring-inset ring-red-100'
                            : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-2xl border border-gray-100 bg-[#F9FAFB] p-4">
            <p className="flex items-center gap-2 text-[14px] font-bold">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-500">
                <Sparkles size={15} />
              </span>
              Need help?
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-500">
              Check our docs for verification workflows and API usage.
            </p>
            <Link
              href="/admin"
              className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-[#111827]"
            >
              View docs <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        <div className="border-t border-gray-100 px-4 pb-5 pt-3">
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-gray-500 hover:bg-gray-100 hover:text-[#111827] disabled:opacity-60"
          >
            <LogOut size={19} />
            {loggingOut ? 'Logging out…' : 'Logout'}
          </button>
          <div className="mt-2 flex items-center gap-3 rounded-2xl px-2 py-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#111827] text-[13px] font-bold text-white">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-bold capitalize">
                {displayName}
              </span>
              <span className="block text-[12px] text-gray-400">Super Admin</span>
            </span>
            <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:pl-[264px]">
        <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 md:px-8">
            <button
              type="button"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <nav className="flex items-center gap-2 text-[14px]" aria-label="Breadcrumb">
              <span className="rounded-full border border-gray-200 px-3.5 py-1.5 font-medium text-[#111827]">
                Admin Panel
              </span>
              <span className="text-gray-400">/</span>
              <span className="font-semibold">{activeLabel}</span>
            </nav>
            <div className="flex-1" />
            <label className="hidden min-w-0 max-w-[340px] flex-1 items-center gap-2 rounded-xl border border-gray-100 bg-[#F9FAFB] px-3.5 py-2.5 text-[14px] text-gray-400 md:flex">
              <Search size={17} className="shrink-0" />
              <input
                type="search"
                placeholder="Search workers, users..."
                className="w-full bg-transparent text-[#111827] outline-none placeholder:text-gray-400"
              />
              <kbd className="shrink-0 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 font-sans text-[11px] font-semibold text-gray-400">
                CMD K
              </kbd>
            </label>
            <Link
              href="/admin/workers"
              className="relative rounded-xl border border-gray-100 bg-white p-2.5 text-[#111827] hover:bg-gray-50"
              aria-label={
                verificationCount && verificationCount > 0
                  ? `${verificationCount} pending worker verifications`
                  : 'No pending worker verifications'
              }
              title="Pending worker verifications"
            >
              <Bell size={19} />
              {/* Real pending count — links straight to the review queue.
                  (This used to be a hardcoded "3".) */}
              {verificationCount !== null && verificationCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {verificationCount > 99 ? '99+' : verificationCount}
                </span>
              )}
            </Link>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111827] text-[13px] font-bold text-white">
              {initials}
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-6 md:px-8">
          {children}
          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-[12px] text-gray-400">
            <span className="font-mono">SahiAdmin v2.4.1</span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
              API: 34ms
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}

