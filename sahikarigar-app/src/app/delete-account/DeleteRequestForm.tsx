'use client';

// =============================================================================
// DeleteRequestForm — the web fallback for account deletion requests.
// =============================================================================
// Google Play requires a web destination where a user can request account
// deletion WITHOUT reinstalling the app. The in-app flow (Profile -> Delete
// Account) is instant; this form emails the admin instead, who completes the
// deletion manually. It POSTs to the auth-server's public
// /account/delete-request endpoint (NEXT_PUBLIC_AUTH_API_URL, same origin
// config the login flow already uses).
// =============================================================================

import { useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2, Send, ShieldCheck } from 'lucide-react';

import { Button, Card, Input } from '@/components/ui';

const AUTH_API_URL = (process.env.NEXT_PUBLIC_AUTH_API_URL ?? '').replace(/\/+$/, '');

type Status = 'idle' | 'sending' | 'done';

/** Only the digits of the input — the server does the strict validation. */
function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function DeleteRequestForm() {
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const digits = digitsOnly(phone);
    // +91 / 0 prefixes are fine client-side; the server accepts exactly this.
    const trimmed = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits;
    if (trimmed.length !== 10 || !/^[6-9]/.test(trimmed)) {
      setError('Sahi 10-digit Indian mobile number daalo (6, 7, 8 ya 9 se shuru).');
      return;
    }

    setStatus('sending');
    try {
      const response = await fetch(`${AUTH_API_URL}/account/delete-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: trimmed, reason }),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; error?: string }
        | null;

      if (response.ok && body?.ok) {
        setStatus('done');
        return;
      }
      // Server sends 429 rate-limit copy in `message`, other failures in
      // `error` — read both so the real reason always surfaces (C12).
      setError(body?.message || body?.error || 'Request bhej nahi paye. Thodi der baad try karein.');
      setStatus('idle');
    } catch {
      setError('Internet ki dikkat lagti hai. Thodi der baad try karein.');
      setStatus('idle');
    }
  };

  if (status === 'done') {
    return (
      <Card className="border-green-200 bg-green-50">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-primary-dark" />
          <div>
            <p className="font-semibold text-text-primary">Request mil gayi ✅</p>
            <p className="mt-1 text-small text-text-secondary">
              Aapka account aur uska data 7 din ke andar delete kar diye jayenge. Us
              number pe dobara login ki zaroorat nahi padegi — delete hone ke baad wo
              number bilkul fresh signup ki tarah use ho sakta hai.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start gap-3 mb-4">
        <ShieldCheck className="h-6 w-6 shrink-0 text-primary-dark" />
        <div>
          <p className="font-semibold text-text-primary">App ke bina delete request bhejo</p>
          <p className="mt-1 text-small text-text-secondary">
            App install karne ki zaroorat nahi. Apna registered number daalo — hum
            request milte hi account delete kar dete hain.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Mobile number (jispe account hai)"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="10-digit number, jaise 98XXXXXX21"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={15}
          required
        />

        <div>
          <label
            htmlFor="delete-reason"
            className="block text-body font-medium text-text-primary mb-2"
          >
            Wajah (optional)
          </label>
          <textarea
            id="delete-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Kyun delete karwa rahe hain — aapki feedback se app behtar hoti hai"
            className="w-full bg-gray-50 border-2 border-transparent rounded-button px-4 py-3 text-body focus:border-primary-dark focus:bg-white transition-all duration-150 placeholder:text-text-secondary resize-none"
          />
        </div>

        {error ? (
          <p role="alert" className="text-small font-medium text-danger">
            {error}
          </p>
        ) : null}

        <Button type="submit" isLoading={status === 'sending'} fullWidth>
          {status === 'sending' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Bhej rahe hain...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden />
              Delete request bhejo
            </>
          )}
        </Button>

        <p className="text-caption text-text-secondary">
          Ye request sirf account delete karne ke liye hai. Koi payment ya personal
          document yahan mangaya nahi jata.
        </p>
      </form>
    </Card>
  );
}
