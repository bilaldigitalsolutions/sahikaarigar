'use client';

// =============================================================================
// SuperTokens phone + OTP panel
// =============================================================================
// Drop-in replacement for PhoneAuthPanel. Same props, same UI language — but
// the flow goes through `auth-server/` and needs NO reCAPTCHA (SuperTokens does
// not require it for user-input-code flows).
// =============================================================================

import { useEffect, useState } from 'react';
import { Phone, ShieldCheck, RotateCcw } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { requestOtp, resendOtp, verifyOtp } from '@/lib/supertokens';
import { isValidPhone } from '@/utils';

const RESEND_SECONDS = 30;

interface SuperTokensPhonePanelProps {
  /** Called once the OTP is verified and the session exists. */
  onVerified: (phone: string) => void | Promise<void>;
  ctaLabel?: string;
}

export function SuperTokensPhonePanel({ onVerified, ctaLabel }: SuperTokensPhonePanelProps) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function handleSendOtp() {
    setError(null);

    if (!isValidPhone(phone)) {
      setError('Sahi 10-digit mobile number daalo (6, 7, 8 ya 9 se shuru).');
      return;
    }

    setLoading(true);
    try {
      await requestOtp(phone);
      setStep('otp');
      setOtp('');
      setSecondsLeft(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP nahi bhej paye.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setLoading(true);
    try {
      await resendOtp();
      setSecondsLeft(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Naya OTP nahi bhej paye.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setError(null);

    if (otp.trim().length !== 6) {
      setError('6-digit OTP poora daalo.');
      return;
    }

    setLoading(true);
    try {
      await verifyOtp(otp.trim());
      await onVerified(phone);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verify nahi hua.');
    } finally {
      setLoading(false);
    }
  }

  function handleChangeNumber() {
    setStep('phone');
    setOtp('');
    setError(null);
    setSecondsLeft(0);
  }

  return (
    <div className="space-y-4">
      {step === 'phone' ? (
        <>
          <Input
            label="Mobile Number"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="98765 43210"
            value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
            leftIcon={<Phone size={18} />}
            helperText="Aapke number par 6-digit ka OTP aayega"
            error={error ?? undefined}
            autoComplete="tel"
          />
          <Button fullWidth size="lg" isLoading={loading} onClick={handleSendOtp}>
            OTP Bhejo
          </Button>
        </>
      ) : (
        <>
          <div className="rounded-card bg-gray-50 px-4 py-3 text-small text-text-secondary">
            OTP bheja gaya: <span className="font-semibold text-text-primary">+91 {phone}</span>
          </div>

          <Input
            label="6-Digit OTP"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="• • • • • •"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            leftIcon={<ShieldCheck size={18} />}
            error={error ?? undefined}
            autoComplete="one-time-code"
            autoFocus
          />

          <Button fullWidth size="lg" isLoading={loading} onClick={handleVerify}>
            {ctaLabel ?? 'Verify karo'}
          </Button>

          <div className="flex items-center justify-between text-small">
            <button
              type="button"
              onClick={handleResend}
              disabled={loading || secondsLeft > 0}
              className="text-primary-dark hover:underline disabled:text-text-secondary disabled:no-underline"
            >
              {secondsLeft > 0 ? `Naya OTP (${secondsLeft}s)` : 'Naya OTP bhejo'}
            </button>

            <button
              type="button"
              onClick={handleChangeNumber}
              className="flex items-center gap-1 text-text-secondary hover:text-primary-dark"
            >
              <RotateCcw size={14} />
              Number badlo
            </button>
          </div>
        </>
      )}
    </div>
  );
}
