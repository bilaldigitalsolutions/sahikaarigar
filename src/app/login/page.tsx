'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Header, Footer, SuperTokensPhonePanel } from '@/components';
import { Card, Button } from '@/components/ui';
import { useAuth } from '@/components/providers';

export default function LoginPage() {
  const router = useRouter();
  const { isLoggedIn, loading, refresh } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerified() {
    setSubmitting(true);
    setError(null);
    try {
      // The SuperTokens session already exists once the OTP is consumed;
      // refresh() pulls the matching Supabase user row.
      await refresh();
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login fail ho gaya.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Header />

      <main className="max-w-md mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Login karo</h1>
          <p className="text-text-secondary">
            Mobile number daalo, OTP se seedha login ho jayega
          </p>
        </div>

        <Card>
          {loading ? (
            <p className="text-text-secondary text-center py-6">Check kar rahe hain…</p>
          ) : isLoggedIn ? (
            <div className="text-center space-y-4 py-2">
              <p className="text-body">Aap pehle se login ho.</p>
              <Link href="/dashboard">
                <Button fullWidth>Dashboard kholo</Button>
              </Link>
            </div>
          ) : (
            <>
              <SuperTokensPhonePanel onVerified={handleVerified} ctaLabel="Login karo" />

              {submitting && (
                <p className="mt-4 text-small text-text-secondary text-center">
                  Login ho raha hai…
                </p>
              )}

              {error && (
                <p
                  className="mt-4 rounded-button bg-red-50 px-4 py-3 text-small text-danger"
                  role="alert"
                >
                  {error}
                </p>
              )}
            </>
          )}
        </Card>

        <div className="mt-8 text-center text-small text-text-secondary space-y-2">
          <p>Naya ho? Register karo:</p>
          <div className="flex gap-3 justify-center">
            <Link href="/register/worker" className="text-primary-dark font-semibold hover:underline">
              Worker hu
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/register/employer" className="text-primary-dark font-semibold hover:underline">
              Kaam karwana hai
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
