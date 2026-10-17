'use client';

import { useEffect, useState } from 'react';
import { Search, ShieldCheck, UserRound } from 'lucide-react';
import { Header, Footer } from '@/components';
import { AdminNavigation } from '@/components/admin/AdminNavigation';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { Button, Card } from '@/components/ui';
import { listAdminUsers, setAdminUserActive, type ApiAdminUser } from '@/lib/api';

type ManagedRole = 'employer' | 'worker';

export default function AdminUsersPage() {
  const [role, setRole] = useState<ManagedRole>('employer');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<ApiAdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void listAdminUsers(role, search, page)
        .then(({ users: result, pagination: pageInfo }) => {
          if (!cancelled) {
            setUsers(result);
            setPagination({ pages: pageInfo.pages, total: pageInfo.total });
          }
        })
        .catch((reason: unknown) => {
          if (!cancelled) setError(reason instanceof Error ? reason.message : 'Users load nahi hue.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [role, search, page]);

  async function toggleActive(user: ApiAdminUser) {
    setBusyId(user.id);
    setError(null);
    try {
      const { user: updated } = await setAdminUserActive(user.id, !user.isActive);
      setUsers((current) => current.map((item) => item.id === user.id
        ? { ...item, isActive: updated.isActive }
        : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'User status update nahi hua.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck size={24} className="text-primary-dark" />
          <h1 className="text-2xl font-bold">User management</h1>
        </div>
        <AdminNavigation />

        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <div className="flex gap-2">
            {(['employer', 'worker'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setRole(value);
                  setPage(1);
                }}
                aria-pressed={role === value}
                className={`rounded-full border px-4 py-2 text-small font-medium capitalize ${
                  role === value
                    ? 'border-primary-dark bg-primary-dark text-white'
                    : 'border-gray-200 bg-white text-text-secondary'
                }`}
              >
                {value}s
              </button>
            ))}
          </div>
          <label className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search name or phone"
              className="w-full rounded-button border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-small"
            />
          </label>
        </div>

        {error && <p className="mb-4 rounded-button bg-red-50 px-4 py-3 text-small text-danger" role="alert">{error}</p>}
        {loading ? (
          <Card><p className="py-8 text-center text-text-secondary">Loading users…</p></Card>
        ) : users.length === 0 ? (
          <Card><p className="py-8 text-center text-text-secondary">Koi {role} nahi mila.</p></Card>
        ) : (
          <div className="space-y-3">
            {users.map((managedUser) => (
              <Card key={managedUser.id}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    {managedUser.avatar ? (
                      <img src={managedUser.avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-green-50 text-primary-dark">
                        <UserRound size={20} />
                      </span>
                    )}
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold">{managedUser.name}</h2>
                      <p className="text-small text-text-secondary">+91 {managedUser.phone}</p>
                      <p className="text-caption text-text-secondary">
                        Joined {new Date(managedUser.createdAt).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-caption font-semibold ${
                      managedUser.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {managedUser.isActive ? 'Active' : 'Suspended'}
                    </span>
                    <Button
                      size="sm"
                      variant={managedUser.isActive ? 'secondary' : 'primary'}
                      isLoading={busyId === managedUser.id}
                      onClick={() => void toggleActive(managedUser)}
                    >
                      {managedUser.isActive ? 'Block / suspend' : 'Restore account'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        {!loading && users.length > 0 && (
          <AdminPagination
            page={page}
            pages={pagination.pages}
            total={pagination.total}
            onPageChange={setPage}
          />
        )}
      </main>
      <Footer />
    </>
  );
}
