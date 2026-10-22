'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { adminLogin, getAdminSession, isAdminSignedOut } from '@/lib/api';

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

      await adminLogin({ email, password });
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
    // The session is an HttpOnly cookie the client cannot inspect, so the only
    // way to know whether we are logged in is to ask the server. Crucially:
    //   - 401        -> real expiry/invalid session: show the login form.
    //   - 5xx/network -> a cold Render start or a hiccup: DO NOT log the admin
    //                    out; keep the shell and let individual calls retry.
    let cancelled = false;

    // An EXPLICIT logout always wins. The HttpOnly cookie may still be valid
    // server-side (the logout call can fail when the backend is asleep), and
    // without this check the guard would silently restore the session on the
    // next load — which is exactly the "Logout does nothing" bug.
    if (isAdminSignedOut()) {
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    const verify = async () => {
      try {
        await getAdminSession();
        if (!cancelled) setIsAuthenticated(true);
      } catch (error) {
        if (cancelled) return;
        const status = (error as Error & { status?: number }).status;
        // Only a definitive 401 means "not logged in". Anything else (503,
        // 500, network failure) is treated as "cannot verify right now" — we
        // optimistically keep the admin in so the UI doesn't bounce to login.
        if (status === 401) setIsAuthenticated(false);
        else if (isAdminSignedOut()) setIsAuthenticated(false);
        else setIsAuthenticated(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void verify();

    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      setLoading(false);
    };

    // A logout in another tab clears the (non-secret) admin email and fires
    // our unauthorized event via adminApiFetch; keep tabs in sync.
    window.addEventListener('sahikarigar-admin-unauthorized', handleUnauthorized);

    // The explicit "signed out" marker lives in localStorage, so a logout in
    // another tab is observable here through the storage event.
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === 'admin_signed_out') {
        if (isAdminSignedOut()) {
          setIsAuthenticated(false);
          setLoading(false);
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      cancelled = true;
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
