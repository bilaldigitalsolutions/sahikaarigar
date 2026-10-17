'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Users, UserCheck, ShieldCheck } from 'lucide-react';
import { Header, Footer } from '@/components';
import { AdminNavigation } from '@/components/admin/AdminNavigation';
import { Card } from '@/components/ui';
import { getAdminStats, type ApiAdminStats } from '@/lib/api';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<ApiAdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getAdminStats()
      .then(({ stats: result }) => {
        if (!cancelled) setStats(result);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Stats load nahi hue.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    { label: 'Total users', value: stats?.totalUsers, icon: Users, href: '/admin/users' },
    { label: 'Total hires', value: stats?.totalHires, icon: ClipboardList, href: '/admin/hires' },
    {
      label: 'Pending verifications',
      value: stats?.pendingVerifications,
      icon: UserCheck,
      href: '/admin/approvals',
    },
  ];

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck size={26} className="text-primary-dark" />
          <div>
            <h1 className="text-2xl font-bold">Admin dashboard</h1>
            <p className="text-small text-text-secondary">Platform overview and management</p>
          </div>
        </div>
        <AdminNavigation />

        {error && <p className="mb-4 rounded-button bg-red-50 px-4 py-3 text-small text-danger" role="alert">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          {cards.map(({ label, value, icon: Icon, href }) => (
            <Link key={label} href={href}>
              <Card className="h-full transition-shadow hover:shadow-card-hover">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-small text-text-secondary">{label}</p>
                    <p className="mt-2 text-3xl font-bold">{value ?? '—'}</p>
                  </div>
                  <Icon size={26} className="text-primary-dark" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
