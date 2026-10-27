'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Briefcase,
  ChevronRight,
  ClipboardList,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  getAdminStats,
  listAdminWorkers,
  displayName,
  type ApiAdminStats,
  type ApiAdminWorker,
} from '@/lib/api';

type ActivityStatus = 'Pending' | 'Verified' | 'Review';

interface ActivityRow {
  id: string;
  name: string;
  shortId: string;
  initials: string;
  avatarBg: string;
  category: string;
  location: string;
  status: ActivityStatus;
  time: string;
}

const AVATAR_COLORS = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-orange-500'];

/** How often the dashboard quietly re-fetches while the tab is visible. */
const POLL_INTERVAL_MS = 30_000;

function formatNumber(value: number | string): string {
  if (typeof value === 'string') return value;
  return value.toLocaleString('en-IN');
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return 'WK';
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'recently';
  const diffMs = Date.now() - then;
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function workerToActivityRow(worker: ApiAdminWorker, index: number): ActivityRow {
  const name = displayName(worker.user?.name);
  const skills = worker.skills ?? [];
  const category =
    skills.length > 0
      ? skills[0].charAt(0).toUpperCase() + skills[0].slice(1)
      : 'General';
  const area = worker.user?.locationArea?.trim();
  const city = worker.user?.locationCity?.trim();
  const location = [area, city].filter(Boolean).join(', ') || (worker.serviceAreas?.[0] ?? 'India');
  const status: ActivityStatus =
    worker.verificationStatus === 'approved' || worker.isApproved ? 'Verified' : 'Pending';
  return {
    id: worker.id,
    name,
    shortId: `ID #${worker.id.slice(0, 4).toUpperCase() || '2048'}`,
    initials: initialsFor(name),
    avatarBg: AVATAR_COLORS[index % AVATAR_COLORS.length],
    category,
    location,
    status,
    time: worker.createdAt ? timeAgo(worker.createdAt) : 'recently',
  };
}

function StatusPill({ status }: { status: ActivityStatus }) {
  const styles: Record<ActivityStatus, string> = {
    Pending: 'bg-amber-50 text-amber-700 ring-amber-200',
    Verified: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    Review: 'bg-blue-50 text-blue-700 ring-blue-200',
  };
  const dot: Record<ActivityStatus, string> = {
    Pending: 'bg-amber-500',
    Verified: 'bg-emerald-500',
    Review: 'bg-blue-500',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset ${styles[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot[status]}`} />
      {status}
    </span>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<ApiAdminStats | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [pendingTotal, setPendingTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadAll = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      // `silent` is the background poll: no spinner flash, and a transient
      // failure leaves the numbers already on screen untouched. Manual refresh
      // and the first load do NOT pass it, so they DO show the spinner.
      if (!silent) setLoading(true);
      setError(null);
      try {
        // Real data only — no hardcoded fallbacks. The admin session cookie is
        // attached automatically by adminApiFetch (`credentials: 'include'`).
        const [statsRes, workersRes] = await Promise.all([
          getAdminStats(),
          listAdminWorkers('pending', 1),
        ]);
        setStats(statsRes.stats);
        setPendingTotal(workersRes.pagination.total);
        setActivity((workersRes.workers ?? []).slice(0, 5).map(workerToActivityRow));
        // Requirement: every successful refresh (manual OR automatic) advances
        // the timestamp shown in the header.
        setLastUpdated(new Date());
        setLoading(false);
      } catch (loadError) {
        if (!silent) {
          setStats(null);
          setActivity([]);
          setPendingTotal(0);
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Stats load nahi hue. Kripya dobara try karein.',
          );
        } else {
          // Keep whatever is already on screen; the next tick retries.
          console.warn('[admin] background refresh failed:', loadError);
        }
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    // Guard so a slow background request can never be stacked on top of the
    // next tick (Render cold starts can take a while).
    let inFlight = false;

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        await loadAll({ silent: true });
      } finally {
        inFlight = false;
      }
    };

    const stopPolling = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const startPolling = () => {
      stopPolling();
      timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
    };

    // First load shows the spinner (it is not a background refresh).
    void loadAll();

    // Pause when the tab is hidden — a background tab should not keep hitting
    // the API. On return, refresh immediately (catch up) then resume the timer.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void tick();
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (document.visibilityState === 'visible') startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadAll]);
  const cards = useMemo(
    () => [
      {
        label: 'Total Users',
        value: stats ? formatNumber(stats.totalUsers) : loading ? '…' : '--',
        icon: Users,
        iconBox: 'bg-blue-50 text-blue-600 ring-blue-100',
      },
      {
        label: 'Total Hires',
        value: stats ? formatNumber(stats.totalHires) : loading ? '…' : '--',
        icon: Briefcase,
        iconBox: 'bg-violet-50 text-violet-600 ring-violet-100',
      },
      {
        label: 'Pending Verifications',
        value: stats ? formatNumber(stats.pendingVerifications) : loading ? '…' : '--',
        icon: UserCheck,
        iconBox: 'bg-amber-50 text-amber-600 ring-amber-100',
      },
      {
        label: 'Active Workers',
        value:
          stats && stats.activeWorkers !== undefined && stats.activeWorkers !== null
            ? formatNumber(stats.activeWorkers)
            : loading
              ? '…'
              : '--',
        icon: Activity,
        iconBox: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
      },
    ],
    [stats, loading],
  );

  const quickActions = [
    {
      label: 'Verify Workers',
      desc: 'Review documents, background checks and approve trusted workers.',
      href: '/admin/workers',
      icon: UserCheck,
      iconBox: 'bg-emerald-50 text-emerald-500 ring-emerald-100',
      pill: `${pendingTotal} pending`,
      cta: 'Start verification',
    },
    {
      label: 'Manage Users',
      desc: 'View user activity, handle disputes and manage platform access.',
      href: '/admin/users',
      icon: Users,
      iconBox: 'bg-violet-50 text-violet-500 ring-violet-100',
      pill: stats ? `${formatNumber(stats.totalUsers)} total` : 'total',
      cta: 'Manage users',
    },
    {
      label: 'Hire Requests',
      desc: 'Monitor ongoing hires, payments and completion status in real-time.',
      href: '/admin/hires',
      icon: ClipboardList,
      iconBox: 'bg-orange-50 text-orange-500 ring-orange-100',
      pill: stats ? `${formatNumber(stats.totalHires)} total` : 'total',
      cta: 'View requests',
    },
  ];

  return (
    <div className="space-y-6 text-[#111827]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">Dashboard</h1>
          <p className="mt-1 text-[14px] text-gray-500">
            Platform overview and worker management
            {lastUpdated
              ? ` • Last updated ${lastUpdated.toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  // Seconds matter now that the dashboard refreshes every 30s.
                  second: '2-digit',
                })}`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-[14px] font-semibold text-[#111827] hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? 'Refreshing…' : 'Refresh'} <ArrowUpRight size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 md:p-5" role="alert">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <AlertTriangle size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold text-[#7c4a12]">
                {error}
              </p>
              <p className="mt-1 text-[13px] text-amber-800/80">
                Neeche di gayi details check karo — token expire ho sakta hai ya backend
                abhi deploy ho raha hai. Retry karne se pehle dobara login karke dekho.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void loadAll()}
                  className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-4 py-2 text-[13px] font-semibold text-white hover:bg-black"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20">
                    <ChevronRight size={12} />
                  </span>
                  Dobara try karo
                </button>
              </div>
              <p className="mt-2 font-mono text-[11px] text-amber-700/70">{error}</p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setError(null)}
              className="rounded-full border border-amber-200 p-1.5 text-amber-700 hover:bg-amber-100"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-3xl border border-gray-100 bg-white p-5"
          >
            <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset ${card.iconBox}`}>
              <card.icon size={20} />
            </span>
            <p className="mt-4 text-[14px] font-medium text-gray-500">{card.label}</p>
            <p className="mt-1 flex items-center gap-2 text-[30px] font-extrabold leading-none tracking-tight">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {quickActions.map((action) => (
          <div
            key={action.label}
            className="flex flex-col rounded-3xl border border-gray-100 bg-white p-6"
          >
            <div className="flex items-start justify-between">
              <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-inset ${action.iconBox}`}>
                <action.icon size={22} />
              </span>
              <span className="rounded-full bg-gray-50 px-3 py-1 text-[12px] font-medium text-gray-500 ring-1 ring-inset ring-gray-100">
                {action.pill}
              </span>
            </div>
            <h3 className="mt-5 text-[18px] font-extrabold tracking-tight">{action.label}</h3>
            <p className="mt-1.5 flex-1 text-[14px] leading-relaxed text-gray-500">{action.desc}</p>
            <Link
              href={action.href}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#111827] px-5 py-3 text-[14px] font-semibold text-white hover:bg-black"
            >
              {action.cta} <ArrowUpRight size={16} className="opacity-70" />
            </Link>
          </div>
        ))}
      </div>
      <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <h2 className="text-[17px] font-extrabold tracking-tight">Pending verifications</h2>
          <span className="rounded-full bg-gray-50 px-3 py-1 text-[12px] font-medium text-gray-600 ring-1 ring-inset ring-gray-100">
            Newest first
          </span>
          <div className="flex-1" />
        </div>

        <div className="overflow-x-auto border-t border-gray-100">
          <table className="w-full min-w-[820px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">
                <th className="px-5 py-3.5 font-semibold">Worker</th>
                <th className="px-5 py-3.5 font-semibold">Category</th>
                <th className="px-5 py-3.5 font-semibold">Location</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 font-semibold">Time</th>
                <th className="px-5 py-3.5 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                    Loading recent activity…
                  </td>
                </tr>
              ) : activity.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                    Abhi koi pending verification nahi hai. Naye worker registrations yahan
                    dikhengi.
                  </td>
                </tr>
              ) : (
                activity.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/60">
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ${row.avatarBg}`}>
                        {row.initials}
                      </span>
                      <span>
                        <span className="block font-semibold text-[#111827]">{row.name}</span>
                        <span className="block text-[12px] text-gray-400">{row.shortId}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{row.category}</td>
                  <td className="px-5 py-3.5 text-gray-500">{row.location}</td>
                  <td className="px-5 py-3.5">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-gray-400">{row.time}</td>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center justify-end">
                      <Link
                        href="/admin/workers"
                        aria-label={`Review ${row.name} in Worker Verification`}
                        className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Review <ChevronRight size={13} />
                      </Link>
                    </span>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3.5">
          <p className="text-[13px] text-gray-400">
            Showing {activity.length} of {pendingTotal} pending verifications
          </p>
          <Link
            href="/admin/workers"
            className="inline-flex items-center gap-1 text-[14px] font-semibold hover:text-emerald-700"
          >
            View all <ChevronRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
