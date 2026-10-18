'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button, Card } from '@/components/ui';

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
      const res = await fetch(`https://sahikaarigar-auth.onrender.com/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      console.log("Status:", res.status);

      const data = await res.json();
      console.log("Response Data:", data);

      if (!res.ok) {
        throw new Error(data.message || "Invalid credentials");
      }

      const token = data.token || data.accessToken || data.session;

      if (!token) {
        console.error("Token missing in response:", data);
        throw new Error("Token missing from server");
      }

      localStorage.setItem('admin_token', token);
      if (data.admin?.email) {
        localStorage.setItem('admin_email', data.admin.email);
      }

      window.location.href = '/admin';

    } catch (err) {
      console.error("Login catch error:", err);
      setError(err instanceof Error ? err.message : "Admin request fail ho gayi");
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
    let cancelled = false;
    const checkSession = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;

      // Agar token nahi hai, toh API call mat karo, seedha login page dikhao
      if (!token) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      try {
        // Agar token hai, tabhi API call karo
        const API_URL = (process.env.NEXT_PUBLIC_AUTH_API_URL ?? '').replace(/\/+$/, '');
        const res = await fetch(`${API_URL}/admin/session`, {
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!cancelled) {
          if (res.ok) {
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_email');
            setIsAuthenticated(false);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    checkSession();

    return () => {
      cancelled = true;
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
