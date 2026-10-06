'use client';

import { useEffect, useState } from 'react';
import { Phone, ShieldCheck, RotateCcw } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { confirmOtp, resetPhoneAuth, sendOtp, toE164, type PhoneSession } from '@/lib/firebase';
import { isValidPhone } from '@/utils';

const RECAPTCHA_ID = 'sahikaarigar-recaptcha';

interface PhoneAuthPanelProps {
  onVerified: (session: PhoneSession) => void | Promise<void>;
  /** Label of the final submit button (defaults to the OTP step). */
  ctaLabel?: string;
}

/** Turns Firebase error codes into something a worker can understand. */
function friendlyError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';

  switch (code) {
    case 'auth/invalid-phone-number':
      return 'Phone number galat hai. 10 digit ka mobile number daalo.';
    case 'auth/too-many-requests':
      return 'Bahut zyada koshish ho gayi. 10-15 minute baad try karo.';
    case 'auth/invalid-verification-code':
      return 'OTP galat hai. SMS me aaya 6-digit code dobara check karo.';
    case 'auth/code-expired':
      return 'OTP expire ho gaya. "Naya OTP bhejo" dabao.';
    case 'auth/quota-exceeded':
      return 'Aaj ka SMS quota khatam. Kal try karo.';
    // Since Sept 2024 Firebase requires a Cloud Billing account (Blaze plan) to
    // send SMS to real numbers; it surfaces this as BILLING_NOT_ENABLED (which
    // the JS SDK can also report as auth/operation-not-allowed). Test phone
    // numbers are exempt and keep working on the free Spark plan.
    case 'auth/billing-not-enabled':
      return 'Real number pe SMS bhejne ke liye Firebase Cloud Billing (Blaze plan) zaroori hai. Development ke liye Firebase Console me test number add karo — wo billing ke bina chalega.';
    case 'auth/operation-not-allowed':
      return 'New number pe SMS abhi nahi bhej sakte. Firebase ne SMS ke liye billing (Blaze plan) zaroori kar diya hai — Console me ek test number add karo ya Cloud Billing link karo.';
    case 'auth/unauthorized-domain':
      return 'Ye domain Firebase me authorized nahi hai.';
    default:
      return error instanceof Error ? error.message : 'Kuch galat ho gaya. Dobara try karo.';
  }
}

export function PhoneAuthPanel({ onVerified, ctaLabel }: PhoneAuthPanelProps) {
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

  // Clean up the reCAPTCHA widget when the panel unmounts.
  useEffect(() => () => resetPhoneAuth(), []);

  async function handleSendOtp() {
    setError(null);

    if (!isValidPhone(phone)) {
      setError('Sahi 10-digit mobile number daalo (6, 7, 8 ya 9 se shuru).');
      return;
    }

    setLoading(true);
    try {
      await sendOtp(phone, RECAPTCHA_ID);
      setStep('otp');
      setOtp('');
      setSecondsLeft(30);
    } catch (err) {
      resetPhoneAuth();
      setError(friendlyError(err));
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
      const session = await confirmOtp(otp.trim());
      await onVerified(session);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  function handleChangeNumber() {
    resetPhoneAuth();
    setStep('phone');
    setOtp('');
    setError(null);
  }

  return (
    <div className="space-y-4">
      {/* Invisible reCAPTCHA (Firebase Phone Auth needs it) */}
      <div id={RECAPTCHA_ID} />

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
            OTP bheja gaya:{' '}
            <span className="font-semibold text-text-primary">{toE164(phone)}</span>
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
              onClick={handleSendOtp}
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
