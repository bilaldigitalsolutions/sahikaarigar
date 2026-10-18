'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { adminLogin, getAdminToken } from '@/lib/api';

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!(process.env.NEXT_PUBLIC_AUTH_API_URL ?? '').trim()) {
        throw new Error('Auth server configure nahi hai (NEXT_PUBLIC_AUTH_API_URL).');
      }

      const data = await adminLogin({ email, password });

      if (data.admin?.email) {
        localStorage.setItem('admin_email', data.admin.email);
      }

      onLogin();
      window.location.href = '/admin';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin request fail ho gayi');
    } finally {
      setLoading(false);
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
        <form className="space-y-4" onSubmit={(event) => void handleLogin(event)}>
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
          <Button type="submit" fullWidth isLoading={loading}>Login</Button>
        </form>
      </Card>
    </main>
  );
}

export function AdminGuard({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Client-side only: localStorage does not exist during SSR. The guard is
    // deliberately "token presence" based — it never pings the API on mount,
    // so a cold Render start, a temporary network error or a 5xx can never log
    // the admin out. Only a real 401 (dispatched by adminApiFetch) clears the
    // token and brings the login form back.
    const syncFromStorage = () => {
      setIsAuthenticated(Boolean(getAdminToken()));
      setLoading(false);
    };

    syncFromStorage();

    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      setLoading(false);
    };

    // Keep multiple admin tabs in sync when one of them logs out / expires.
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === 'admin_token') syncFromStorage();
    };

    window.addEventListener('sahikarigar-admin-unauthorized', handleUnauthorized);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('sahikarigar-admin-unauthorized', handleUnauthorized);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  if (loading) {
    return (
      <Card className="mx-auto mt-10 max-w-xl text-center text-text-secondary">
        Admin session verify ho raha hai…
      </Card>
    );
  }

  if (!isAuthenticated) return <AdminLogin onLogin={() => setIsAuthenticated(true)} />;

  return <>{children}</>;
}

export default AdminGuard;
