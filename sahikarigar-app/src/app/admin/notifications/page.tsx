'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, Send, SendToBack, Users } from 'lucide-react';
import {
  getAdminBroadcastPreview,
  sendAdminBroadcast,
  type AdminBroadcastResult,
} from '@/lib/api';

const AUDIENCES = [
  { value: 'all', label: 'Sab users' },
  { value: 'workers', label: 'Sirf Kaarigar' },
  { value: 'customers', label: 'Sirf Customer' },
] as const;

type Audience = (typeof AUDIENCES)[number]['value'];

/**
 * Admin broadcast push.
 *
 * Flow: copy likho → (optional) apne phone pe TEST bhejo → live device count
 * dekho → confirm → send. Suspended users aur admins kabhi receive nahi karte,
 * aur sirf wahi users jitne ne app mein notifications allow ki hain.
 */
export default function AdminNotificationsPage() {
  const [audience, setAudience] = useState<Audience>('all');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [preview, setPreview] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [busy, setBusy] = useState<'send' | 'test' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const titleLen = title.trim().length;
  const messageLen = message.trim().length;
  const titleValid = titleLen >= 3 && titleLen <= 60;
  const messageValid = messageLen >= 5 && messageLen <= 200;
  const canSend = titleValid && messageValid;

  // Live device count for the selected audience (debounced).
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPreviewLoading(true);
      setError(null);
      void getAdminBroadcastPreview(audience)
        .then((count) => {
          if (!cancelled) setPreview(count);
        })
        .catch((reason: unknown) => {
          if (!cancelled) {
            setPreview(null);
            setError(reason instanceof Error ? reason.message : 'Count load nahi hua.');
          }
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [audience]);

  const describeResult = useCallback(
    (data: AdminBroadcastResult, mode: 'send' | 'test') => {
      if (mode === 'test') {
        return data.sent
          ? `Test notification apke phone pe pahunch gayi (${data.sent}). Copy theek hai to 'Sabko Bhejo' dabao.`
          : 'Test send fail hua — upar ka error dekho.';
      }
      return `Bhej di gayi! Bheji: ${data.sent ?? 0}, Fail: ${data.failed ?? 0} (total ${data.matched ?? 0} devices).`;
    },
    [],
  );

  async function handleTest() {
    setBusy('test');
    setError(null);
    setResult(null);
    try {
      const data = await sendAdminBroadcast({ title, body: message, testPhone });
      setResult(describeResult(data, 'test'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Test send fail hua.');
    } finally {
      setBusy(null);
    }
  }

  async function handleSend() {
    const count = preview ?? 0;
    const confirmed = window.confirm(
      `Ye notification ${count} users ke devices pe jayegi. Confirm karo?`,
    );
    if (!confirmed) return;
    setBusy('send');
    setError(null);
    setResult(null);
    try {
      const data = await sendAdminBroadcast({ title, body: message, audience });
      setResult(describeResult(data, 'send'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Broadcast fail hua.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6 text-[#111827]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Bell className="h-5 w-5 text-[#16A34A]" />
            Notifications bhejo
          </h1>
          <p className="mt-1 text-small text-gray-500">
            Sab users / sirf kaarigar / sirf customer ko push notification. Sirf wahi
            log receive karte hain jitne ne app mein notifications allow ki hain.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3">
          <Users className="h-4 w-4 text-gray-400" />
          <span className="text-small text-gray-500">
            {previewLoading
              ? 'Count aa raha hai…'
              : preview !== null
                ? `${preview} devices receive karenge`
                : 'Count nahi mila'}
          </span>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-small text-red-700">
          {error}
        </div>
      ) : null}
      {result ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-small text-green-800">
          {result}
        </div>
      ) : null}

      <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6">
        <div>
          <label className="mb-2 block text-small font-medium">Audience</label>
          <div className="flex flex-wrap gap-2">
            {AUDIENCES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setAudience(value)}
                className={
                  'rounded-full border px-4 py-2 text-small font-medium transition-colors ' +
                  (audience === value
                    ? 'border-[#14532D] bg-[#14532D] text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-[#16A34A] hover:text-[#14532D]')
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="bc-title" className="mb-2 block text-small font-medium">
            Title (3–60 characters)
          </label>
          <input
            id="bc-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={60}
            placeholder="App update aa gaya hai!"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-small outline-none focus:border-[#16A34A]"
          />
          <p className={'mt-1 text-xs ' + (titleValid ? 'text-gray-400' : 'text-amber-600')}>
            {titleLen}/60
          </p>
        </div>

        <div>
          <label htmlFor="bc-body" className="mb-2 block text-small font-medium">
            Message (5–200 characters)
          </label>
          <textarea
            id="bc-body"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={200}
            rows={3}
            placeholder="Naya version install karo aur naye features dekho!"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-small outline-none focus:border-[#16A34A]"
          />
          <p className={'mt-1 text-xs ' + (messageValid ? 'text-gray-400' : 'text-amber-600')}>
            {messageLen}/200
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-small font-medium text-amber-800">
            Pehle test karo (recommended)
          </p>
          <p className="mb-3 text-xs text-amber-700">
            Apna phone number daalo (jahan app installed hai) — notification SIRF apke
            device pe jayegi. Copy pasand aaye to hi sabko bhejo.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={testPhone}
              onChange={(event) => setTestPhone(event.target.value)}
              maxLength={15}
              placeholder="Apna 10-digit number"
              className="w-56 rounded-lg border border-gray-200 px-3 py-2 text-small outline-none focus:border-[#16A34A]"
            />
            <button
              type="button"
              onClick={handleTest}
              disabled={busy !== null || !canSend || testPhone.trim().length < 10}
              className="flex items-center gap-2 rounded-lg border border-[#16A34A] px-4 py-2 text-small font-medium text-[#14532D] transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SendToBack className="h-4 w-4" />
              {busy === 'test' ? 'Test ho raha hai…' : 'Test bhejo (sirf mujhe)'}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={busy !== null || !canSend}
          className="flex items-center gap-2 rounded-lg bg-[#16A34A] px-5 py-2.5 text-small font-semibold text-white transition-colors hover:bg-[#14532D] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
          {busy === 'send' ? 'Bhej rahe hain…' : 'Sabko Bhejo (confirm ke baad)'}
        </button>
      </div>
    </div>
  );
}
