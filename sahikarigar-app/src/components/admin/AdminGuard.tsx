'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import {
  adminLogin,
  adminLogout,
  getAdminSession,
  getAdminToken,
  type AdminSession,
} from '@/lib/api';

function AdminLogin({
  onLogin,
}: {
  onLogin: (session: AdminSession) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { admin } = await adminLogin({ email, password });
      const token = getAdminToken();
      if (token) {
        localStorage.setItem('admin_token', token);
      }
      setPassword('');
      onLogin(admin);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Admin login nahi hua.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Card className="space-y-5">
        <div className="text-center">
          <ShieldCheck size={42} className="mx-auto text-primary-dark" />
          <h1 className="mt-3 text-2xl font-bold">Admin login</h1>
          <p className="mt-1 text-small text-text-secondary">Email aur password se sign in karein.</p>
        </div>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <div>
            <label htmlFor="admin-email" className="mb-1 block text-small font-medium">Email</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-button border border-gray-200 bg-white px-3 py-3 text-small"
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="mb-1 block text-small font-medium">Password</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-button border border-gray-200 bg-white px-3 py-3 text-small"
            />
          </div>
          {error && <p className="rounded-button bg-red-50 px-3 py-2 text-small text-danger" role="alert">{error}</p>}
          <Button type="submit" fullWidth isLoading={submitting}>Login</Button>
        </form>
      </Card>
    </main>
  );
}

export function AdminGuard({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getAdminSession()
      .then(({ admin: session }) => {
        if (!cancelled && session.role === 'admin') setAdmin(session);
      })
      .catch(() => {
        if (!cancelled) setAdmin(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const handleUnauthorized = () => setAdmin(null);
    window.addEventListener('sahikarigar-admin-unauthorized', handleUnauthorized);
    return () => {
      cancelled = true;
      window.removeEventListener('sahikarigar-admin-unauthorized', handleUnauthorized);
    };
  }, []);

  if (loading) {
    return (
      <Card className="mx-auto mt-10 max-w-xl text-center text-text-secondary">
        Admin session verify ho raha hai…
      </Card>
    );
  }

  if (!admin) return <AdminLogin onLogin={setAdmin} />;

  return (
    <>
      <div className="flex items-center justify-end gap-3 border-b bg-white px-4 py-2">
        <span className="text-caption text-text-secondary">{admin.email}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            adminLogout();
            setAdmin(null);
          }}
        >
          <LogOut size={15} className="mr-1" /> Logout
        </Button>
      </div>
      {children}
    </>
  );
}
