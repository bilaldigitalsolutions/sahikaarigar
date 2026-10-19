'use client';

import { useCallback, useEffect, useState } from 'react';
import { Flag, RefreshCw } from 'lucide-react';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  listAdminReports,
  setAdminReportStatus,
  type AdminReportStatus,
  type ApiAdminReport,
} from '@/lib/api';

const STATUSES: { value: 'all' | AdminReportStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

const REASON_LABELS: Record<string, string> = {
  spam_or_fake_profile: 'Spam / fake profile',
  fraud_or_scam: 'Fraud / scam',
  harassment_or_abuse: 'Harassment / abuse',
  inappropriate_content: 'Inappropriate content',
  other: 'Other',
};

const STATUS_PILL_CLASSES: Record<AdminReportStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  reviewed: 'bg-blue-50 text-blue-700 ring-blue-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  dismissed: 'bg-gray-100 text-gray-500 ring-gray-200',
};

const VERDICTS: { value: Exclude<AdminReportStatus, 'pending'>; label: string }[] = [
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'resolved', label: 'Resolve' },
  { value: 'dismissed', label: 'Dismiss' },
];

export default function AdminReportsPage() {
  const [status, setStatus] = useState<'all' | AdminReportStatus>('all');
  const [reports, setReports] = useState<ApiAdminReport[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminReports(status, page);
      if (page > Math.max(result.pagination.pages, 1)) {
        setPage(Math.max(result.pagination.pages, 1));
        return;
      }
      setReports(result.reports);
      setPagination({ pages: result.pagination.pages, total: result.pagination.total });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Reports load nahi hui.');
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markReport(report: ApiAdminReport, verdict: Exclude<AdminReportStatus, 'pending'>) {
    setBusyId(report.id);
    setError(null);
    try {
      const { report: updated } = await setAdminReportStatus(report.id, verdict);
      setReports((current) => current.map((item) => item.id === report.id
        ? { ...item, status: updated.status }
        : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Report update nahi hua.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 text-[#111827]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight">User Reports</h1>
          <p className="mt-1 text-[14px] text-gray-500">
            Users ne jo complaints darj karayi hain — inko review karo aur status update karo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Report status">
        {STATUSES.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={status === item.value}
            onClick={() => {
              setStatus(item.value);
              setPage(1);
            }}
            className={`rounded-full px-4 py-2 text-[14px] font-medium ${
              status === item.value
                ? 'bg-[#111827] text-white'
                : 'border border-gray-200 bg-white text-gray-500 hover:text-[#111827]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-[14px] font-medium text-amber-900" role="alert">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">
                <th className="px-5 py-3.5">Reporter</th>
                <th className="px-5 py-3.5">Reported User</th>
                <th className="px-5 py-3.5">Reason</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                    Loading reports…
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                    Koi report nahi mili.
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3.5">
                      <span className="block font-semibold">{report.reporter?.name ?? 'Unknown'}</span>
                      <span className="block text-[12px] text-gray-400">
                        {report.reporter?.phone ? `+91 ${report.reporter.phone}` : report.reporter?.id.slice(0, 8) ?? ''}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-1.5 font-semibold text-red-600">
                        <Flag size={13} />
                        {report.reported?.name ?? 'Unknown'}
                      </span>
                      <span className="block text-[12px] text-gray-400">
                        {report.reported?.phone ? `+91 ${report.reported.phone}` : report.reported?.id.slice(0, 8) ?? ''}
                      </span>
                      {report.description?.trim() ? (
                        <span className="mt-1 block max-w-[280px] text-[12px] leading-snug text-gray-500">
                          “{report.description.trim()}”
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {REASON_LABELS[report.reason] ?? report.reason}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold capitalize ring-1 ring-inset ${STATUS_PILL_CLASSES[report.status]}`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-gray-400">
                      {new Date(report.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {report.status === 'pending' || report.status === 'reviewed' ? (
                        <span className="inline-flex items-center gap-1.5">
                          {VERDICTS.filter((v) =>
                            v.value === 'reviewed' ? report.status === 'pending' : report.status === 'pending' || report.status === 'reviewed',
                          ).map((v) => (
                            <button
                              key={v.value}
                              type="button"
                              disabled={busyId === report.id}
                              onClick={() => void markReport(report, v.value)}
                              className="rounded-full border border-gray-200 px-3 py-1.5 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                            >
                              {busyId === report.id ? 'Saving…' : v.label}
                            </button>
                          ))}
                        </span>
                      ) : (
                        <span className="text-[12px] text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && reports.length > 0 && (
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
