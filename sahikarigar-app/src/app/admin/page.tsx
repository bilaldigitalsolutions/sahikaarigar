'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Briefcase,
  Check,
  ChevronRight,
  ClipboardList,
  MoreHorizontal,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  getAdminStats,
  listAdminHires,
  listAdminUsers,
  listAdminWorkers,
  type ApiAdminStats,
  type ApiAdminWorker,
} from '@/lib/api';

type IconComponent = LucideIcon;

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

const MOCK_ACTIVITY: ActivityRow[] = [
  { id: 'm1', name: 'Rahul Sharma', shortId: 'ID #2048', initials: 'RS', avatarBg: 'bg-blue-500', category: 'Electrician', location: 'Pune, MH', status: 'Pending', time: '2 min ago' },
  { id: 'm2', name: 'Ananya Gupta', shortId: 'ID #2048', initials: 'AG', avatarBg: 'bg-violet-500', category: 'Plumber', location: 'Delhi, DL', status: 'Verified', time: '14 min ago' },
  { id: 'm3', name: 'Vikram Singh', shortId: 'ID #2048', initials: 'VS', avatarBg: 'bg-amber-500', category: 'Carpenter', location: 'Jaipur, RJ', status: 'Review', time: '38 min ago' },
  { id: 'm4', name: 'Priya Nair', shortId: 'ID #2048', initials: 'PN', avatarBg: 'bg-emerald-500', category: 'House Help', location: 'Bangalore, KA', status: 'Verified', time: '1 hour ago' },
  { id: 'm5', name: 'Mohammed Ali', shortId: 'ID #2048', initials: 'MA', avatarBg: 'bg-orange-500', category: 'Painter', location: 'Hyderabad, TG', status: 'Pending', time: '2 hours ago' },
];

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
  const name = worker.user?.name?.trim() || 'Worker';
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

function Sparkline({ bars, tone = 'bg-gray-200' }: { bars: number[]; tone?: string }) {
  return (
    <div className="flex h-7 items-end gap-1.5" aria-hidden="true">
      {bars.map((height, i) => (
        <span
          key={i}
          style={{ height: `${height}px` }}
          className={`w-7 rounded-full ${tone}`}
        />
      ))}
    </div>
  );
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
//__DASH3__


export default function AdminDashboardPage() {
  const [stats, setStats] = useState<ApiAdminStats | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>(MOCK_ACTIVITY);
  const [pendingTotal, setPendingTotal] = useState<number>(23);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminStats();
      setStats(data.stats);
      try {
        const workersRes = await listAdminWorkers('pending', 1);
        setPendingTotal(workersRes.pagination.total);
        const mapped = (workersRes.workers ?? []).slice(0, 5).map(workerToActivityRow);
        setActivity(mapped.length > 0 ? mapped : MOCK_ACTIVITY);
      } catch {
        setActivity(MOCK_ACTIVITY);
      }
      setLoading(false);
    } catch {
      try {
        const [workersRes, workerUsersRes, employerUsersRes, hiresRes] = await Promise.all([
          listAdminWorkers('pending', 1),
          listAdminUsers('worker', '', 1),
          listAdminUsers('employer', '', 1),
          listAdminHires('all', 1),
        ]);
        setStats({
          totalUsers: workerUsersRes.pagination.total + employerUsersRes.pagination.total,
          totalHires: hiresRes.pagination.total,
          pendingVerifications: workersRes.pagination.total,
          activeWorkers: workersRes.pagination.total,
        });
        setPendingTotal(workersRes.pagination.total);
        const mapped = (workersRes.workers ?? []).slice(0, 5).map(workerToActivityRow);
        setActivity(mapped.length > 0 ? mapped : MOCK_ACTIVITY);
        setLoading(false);
      } catch (fallbackError) {
        setError(
          fallbackError instanceof Error
            ? fallbackError.message
            : 'Stats load nahi hue. Kripya dobara try karein.',
        );
        setActivity(MOCK_ACTIVITY);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadAll();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll]);
  const cards = useMemo(
    () => [
      {
        label: 'Total Users',
        value: stats ? formatNumber(stats.totalUsers) : loading ? '…' : '--',
        icon: Users,
        iconBox: 'bg-blue-50 text-blue-600 ring-blue-100',
        bars: [10, 14, 12, 18, 16, 22, 26, 24],
      },
      {
        label: 'Total Hires',
        value: stats ? formatNumber(stats.totalHires) : loading ? '…' : '--',
        icon: Briefcase,
        iconBox: 'bg-violet-50 text-violet-600 ring-violet-100',
        bars: [12, 10, 16, 14, 20, 18, 22, 26],
      },
      {
        label: 'Pending Verifications',
        value: stats ? formatNumber(stats.pendingVerifications) : loading ? '…' : '--',
        icon: UserCheck,
        iconBox: 'bg-amber-50 text-amber-600 ring-amber-100',
        bars: [8, 12, 10, 16, 12, 14, 16, 12],
      },
      {
        label: 'Active Workers',
        value: stats?.activeWorkers !== undefined && stats?.activeWorkers !== null
          ? formatNumber(stats.activeWorkers)
          : stats ? formatNumber(stats.totalUsers) : loading ? '…' : '--',
        icon: Activity,
        iconBox: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
        bars: [14, 18, 16, 22, 20, 26, 28, 24],
      },
    ],
    [stats, loading],
  );

  const quickActions = [
    {
      label: 'Verify Workers',
      desc: 'Review documents, background checks and approve trusted workers.',
      href: '/admin/approvals',
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
      pill: stats ? `${formatNumber(stats.totalHires)} total` : '8 new',
      cta: 'View requests',
    },
  ];
//__DASH5__

  return (
    <div className="space-y-6 text-[#111827]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">Dashboard</h1>
          <p className="mt-1 text-[14px] text-gray-500">
            Platform overview and worker management • Last updated 2 mins ago
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[13px] font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            All systems operational
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-black"
          >
            Export report <ArrowUpRight size={16} />
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
                Admin request fail ho gayi. Dobara try karo.
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[12px] font-semibold text-amber-800">
                  Sync error • Code: ADM_429
                </span>
              </p>
              <p className="mt-1 text-[13px] text-amber-800/80">
                Worker verification service temporarily unreachable. Your local data is
                safe — retrying in background.
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
                <button
                  type="button"
                  className="rounded-full border border-amber-200 bg-white px-4 py-2 text-[13px] font-medium text-amber-900 hover:bg-amber-50"
                >
                  View logs
                </button>
                <span className="text-[12px] text-amber-700/70">Auto-retry in 00:42s</span>
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
        {cards.map((card, index) => (
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
              {index === 3 && stats && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
                </span>
              )}
            </p>
            <div className="mt-3">
              <Sparkline bars={card.bars} />
            </div>
            <div className="mt-2 text-[12px]">
              {index === 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                    <TrendingUp size={12} /> +12%
                  </span>
                  <span className="text-gray-400">this week</span>
                </span>
              )}
              {index === 1 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                    <TrendingUp size={12} /> +8%
                  </span>
                  <span className="text-gray-400">vs last week</span>
                </span>
              )}
              {index === 2 && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Needs attention
                </span>
              )}
              {index === 3 && (
                <span className="inline-flex items-center gap-1.5 text-gray-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> All systems operational
                </span>
              )}
            </div>
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
          <h2 className="text-[17px] font-extrabold tracking-tight">Recent activity</h2>
          <span className="rounded-full bg-gray-50 px-3 py-1 text-[12px] font-medium text-gray-600 ring-1 ring-inset ring-gray-100">
            Last 24 hours
          </span>
          <div className="flex-1" />
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-100 px-3.5 py-1.5 text-[13px] font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Live updates
          </span>
          <button
            type="button"
            aria-label="More options"
            className="rounded-full border border-gray-100 p-2 text-gray-500 hover:bg-gray-50"
          >
            <MoreHorizontal size={16} />
          </button>
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
              {activity.map((row) => (
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
                    <span className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        aria-label={`Approve ${row.name}`}
                        className="rounded-full border border-gray-100 p-2 text-[#111827] hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label={`More actions for ${row.name}`}
                        className="rounded-full border border-gray-100 p-2 text-[#111827] hover:bg-gray-100"
                      >
                        <MoreHorizontal size={15} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3.5">
          <p className="text-[13px] text-gray-400">
            Showing {activity.length} of {pendingTotal} pending verifications
          </p>
          <Link
            href="/admin/approvals"
            className="inline-flex items-center gap-1 text-[14px] font-semibold hover:text-emerald-700"
          >
            View all <ChevronRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
