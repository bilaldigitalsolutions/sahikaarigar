'use client';

import { useEffect, useState } from 'react';
import { Search, UserRound, Users } from 'lucide-react';
import { AdminPagination } from '@/components/admin/AdminPagination';
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
    <div className="space-y-6 text-[#111827]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight">Manage Users</h1>
          <p className="mt-1 text-[14px] text-gray-500">
            View user activity, handle disputes and manage platform access.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-[13px] font-semibold text-gray-600">
          <Users size={15} /> {pagination.total} {role}s
        </span>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
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
              className={`rounded-full px-4 py-2 text-[14px] font-medium capitalize ${
                role === value
                  ? 'bg-[#111827] text-white'
                  : 'border border-gray-200 bg-white text-gray-500 hover:text-[#111827]'
              }`}
            >
              {value}s
            </button>
          ))}
        </div>
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-gray-100 bg-white px-3.5 py-2.5 text-[14px] text-gray-400">
          <Search size={17} className="shrink-0" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search name or phone"
            className="w-full bg-transparent text-[#111827] outline-none placeholder:text-gray-400"
          />
        </label>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-[14px] font-medium text-amber-900" role="alert">
          {error}
        </div>
      )}
      <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Joined</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-gray-400">
                    Loading users…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-gray-400">
                    Koi {role} nahi mila.
                  </td>
                </tr>
              ) : (
                users.map((managedUser) => (
                  <tr key={managedUser.id} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-3">
                        {managedUser.avatar ? (
                          <img src={managedUser.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                            <UserRound size={18} />
                          </span>
                        )}
                        <span>
                          <span className="block font-semibold">{managedUser.name}</span>
                          <span className="block text-[12px] text-gray-400">+91 {managedUser.phone}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 capitalize text-gray-500">{managedUser.role}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-gray-400">
                      {new Date(managedUser.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                        managedUser.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {managedUser.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        disabled={busyId === managedUser.id}
                        onClick={() => void toggleActive(managedUser)}
                        className={`rounded-full px-4 py-2 text-[13px] font-semibold disabled:opacity-60 ${
                          managedUser.isActive
                            ? 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                            : 'bg-[#111827] text-white hover:bg-black'
                        }`}
                      >
                        {busyId === managedUser.id
                          ? 'Saving…'
                          : managedUser.isActive
                            ? 'Block / suspend'
                            : 'Restore account'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && users.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-3.5">
            <AdminPagination
              page={page}
              pages={pagination.pages}
              total={pagination.total}
              onPageChange={setPage}
            />
          </div>
        )}
      </section>
    </div>
  );
}
