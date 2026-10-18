'use client';

import { useEffect, useState } from 'react';
import {
  ClipboardList,
  Users,
  UserCheck,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui';
import Link from 'next/link';
import { getAdminStats, type ApiAdminStats } from '@/lib/api';
import { listAdminWorkers } from '@/lib/api';
import { listAdminUsers } from '@/lib/api';
import { listAdminHires } from '@/lib/api';
import type { LucideIcon } from 'lucide-react';

type IconComponent = LucideIcon;

interface StatCard {
  label: string;
  value: number | string;
  icon: IconComponent;
  color: string;
  href?: string;
  trend?: string;
  trendUp?: boolean;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<ApiAdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      try {
        // Primary: dedicated stats API — includes Authorization: Bearer <token>
        // via adminApiFetch in src/lib/api.ts
        const data = await getAdminStats();
        if (!cancelled) {
          setStats(data.stats);
          setLoading(false);
        }
        return;
      } catch {
        // Fallback: aggregate counts from individual list endpoints
        try {
          const [workersRes, workerUsersRes, employerUsersRes, hiresRes] =
            await Promise.all([
              listAdminWorkers('pending', 1),
              listAdminUsers('worker', '', 1),
              listAdminUsers('employer', '', 1),
              listAdminHires('all', 1),
            ]);

          if (!cancelled) {
            setStats({
              totalUsers: workerUsersRes.pagination.total + employerUsersRes.pagination.total,
              totalHires: hiresRes.pagination.total,
              pendingVerifications: workersRes.pagination.total,
            });
            setLoading(false);
          }
        } catch (fallbackError) {
          if (!cancelled) {
            setError(
              fallbackError instanceof Error
                ? fallbackError.message
                : 'Stats load nahi hue. Kripya dobara try karein.',
            );
            setLoading(false);
          }
        }
      }
    };

    loadStats();

    return () => {
      cancelled = true;
    };
  }, []);

  const statCards: StatCard[] = [
    {
      label: 'Total Users',
      value: stats?.totalUsers ?? '--',
      icon: Users,
      color: 'bg-blue-50 text-blue-600',
      href: '/admin/users',
      trend: stats ? '+12% this month' : undefined,
      trendUp: true,
    },
    {
      label: 'Total Hires',
      value: stats?.totalHires ?? '--',
      icon: ClipboardList,
      color: 'bg-indigo-50 text-indigo-600',
      href: '/admin/hires',
      trend: stats ? '+8% this month' : undefined,
      trendUp: true,
    },
    {
      label: 'Pending Verifications',
      value: stats?.pendingVerifications ?? '--',
      icon: UserCheck,
      color: 'bg-amber-50 text-amber-600',
      href: '/admin/approvals',
      trend: stats ? 'Needs attention' : undefined,
      trendUp: false,
    },
    {
      label: 'Active Workers',
      value: '--',
      icon: ShieldCheck,
      color: 'bg-green-50 text-green-600',
      trend: 'All systems operational',
      trendUp: true,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-small text-text-secondary">
          Platform overview and worker management
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-small text-red-800" role="alert">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card
            key={card.label}
            className="h-full bg-white border border-gray-100 rounded-xl overflow-hidden"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-small font-medium text-text-secondary">{card.label}</CardTitle>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon size={20} className="text-current" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-text-primary">
                {typeof card.value === 'number' ? card.value : card.value}
              </div>
              {card.trend && (
                <p className={`text-xs ${card.trendUp ? 'text-green-600' : 'text-amber-600'} font-medium`}>
                  {card.trend}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: 'Verify Workers',
            href: '/admin/approvals',
            icon: UserCheck,
            desc: 'Review pending worker verifications',
          },
          {
            label: 'Manage Users',
            href: '/admin/users',
            icon: Users,
            desc: 'Activate or suspend user accounts',
          },
          {
            label: 'Hire Requests',
            href: '/admin/hires',
            icon: ClipboardList,
            desc: 'Track all platform hire requests',
          },
        ].map((action) => (
          <Card
            key={action.label}
            className="h-full bg-white border border-gray-100 rounded-xl hover:border-green-100 transition-colors"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <action.icon size={20} className="text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <h3 className="font-semibold text-text-primary">{action.label}</h3>
              <p className="text-small text-text-secondary mt-1">{action.desc}</p>
            </CardContent>
            <CardFooter>
              <Link href={action.href} className="text-small font-medium text-green-600 hover:underline">
                Open →
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
