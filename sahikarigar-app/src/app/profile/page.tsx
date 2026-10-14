'use client';

import Link from 'next/link';
import { LogOut, Phone, ShieldCheck, User as UserIcon } from 'lucide-react';
import { Header, Footer } from '@/components';
import { Card, Button } from '@/components/ui';
import { useAuth } from '@/components/providers';
import { formatPhone } from '@/utils';

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();

  return (
    <>
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-10">
        {loading ? (
          <Card>
            <p className="text-text-secondary text-center py-8">Loading…</p>
          </Card>
        ) : !user ? (
          <Card>
            <div className="text-center space-y-4 py-4">
              <UserIcon size={40} className="text-primary-light mx-auto" />
              <h1 className="text-xl font-bold">Aap login nahi ho</h1>
              <Link href="/login">
                <Button>Login karo</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <Card>
            <h1 className="text-xl font-bold mb-6">Meri Profile</h1>

            <dl className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-text-secondary text-small">Naam</dt>
                <dd className="font-medium text-right">{user.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-1 text-text-secondary text-small">
                  <Phone size={14} /> Mobile
                </dt>
                <dd className="font-medium text-right">{formatPhone(user.phone)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-1 text-text-secondary text-small">
                  <ShieldCheck size={14} /> Role
                </dt>
                <dd className="font-medium text-right capitalize">{user.role}</dd>
              </div>
              {user.locationArea && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-text-secondary text-small">Area</dt>
                  <dd className="font-medium text-right">{user.locationArea}</dd>
                </div>
              )}
            </dl>

            <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row gap-3">
              <Link href="/dashboard" className="flex-1">
                <Button variant="secondary" fullWidth>
                  Dashboard
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={async () => {
                  await logout();
                }}
              >
                <LogOut size={16} className="mr-2" />
                Logout
              </Button>
            </div>
          </Card>
        )}
      </main>

      <Footer />
    </>
  );
}
