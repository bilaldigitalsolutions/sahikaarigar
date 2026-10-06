'use client';

import Link from 'next/link';
import { Clock, LogOut, Phone, ShieldCheck, User as UserIcon } from 'lucide-react';
import { Header, Footer } from '@/components';
import { Card, Button } from '@/components/ui';
import { useAuth } from '@/components/providers';
import { formatPhone } from '@/utils';

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();

  return (
    <>
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-10">
        {loading ? (
          <Card>
            <p className="text-text-secondary text-center py-8">Loading…</p>
          </Card>
        ) : !user ? (
          <Card>
            <div className="text-center space-y-4 py-4">
              <UserIcon size={40} className="text-primary-light mx-auto" />
              <h1 className="text-xl font-bold">Pehle login karo</h1>
              <p className="text-text-secondary">
                Dashboard dekhne ke liye mobile number se login karo.
              </p>
              <div className="flex gap-3 justify-center">
                <Link href="/login">
                  <Button>Login karo</Button>
                </Link>
                <Link href="/register/worker">
                  <Button variant="secondary">Register karo</Button>
                </Link>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Profile summary */}
            <Card>
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-primary-light flex items-center justify-center shrink-0">
                  <span className="text-xl font-bold text-white">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold truncate">{user.name}</h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-small text-text-secondary">
                    <span className="flex items-center gap-1">
                      <Phone size={14} />
                      {formatPhone(user.phone)}
                    </span>
                    <span className="flex items-center gap-1 capitalize">
                      <ShieldCheck size={14} />
                      {user.role}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await logout();
                  }}
                >
                  <LogOut size={16} className="mr-1" />
                  Logout
                </Button>
              </div>
            </Card>

            {/* Role specific */}
            {user.role === 'worker' ? (
              <Card>
                <div className="flex items-start gap-3">
                  <Clock size={20} className="text-warning mt-0.5 shrink-0" />
                  <div>
                    <h2 className="font-semibold mb-1">Profile review me hai</h2>
                    <p className="text-small text-text-secondary">
                      Admin aapki profile check kar raha hai. Approve hone ke baad aap
                      search me dikhne lagoge.
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              <Card>
                <h2 className="font-semibold mb-2">Kaam shuru karo</h2>
                <p className="text-small text-text-secondary mb-4">
                  Apne area ke verified workers dhoondo aur seedha hire karo.
                </p>
                <Link href="/search">
                  <Button>Workers dhoondo</Button>
                </Link>
              </Card>
            )}
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}
