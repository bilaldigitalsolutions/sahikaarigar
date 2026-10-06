'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Header, Footer, SuperTokensPhonePanel } from '@/components';
import { Card, Button, Input } from '@/components/ui';
import { useAuth } from '@/components/providers';
import { updateProfile } from '@/lib/supertokens';
import { VALIDATION } from '@/constants';

export default function RegisterEmployerPage() {
  const router = useRouter();
  const { refresh } = useAuth();

  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinish() {
    const trimmed = name.trim();

    if (trimmed.length < VALIDATION.NAME_MIN_LENGTH) {
      setNameError('Naam kam se kam 2 letter ka hona chahiye.');
      return;
    }

    if (!verifiedPhone) {
      setError('Phone verify nahi hua. Page refresh karke dobara try karo.');
      return;
    }

    setNameError(null);
    setError(null);
    setSubmitting(true);

    try {
      await updateProfile({ name: trimmed });
      await refresh();
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration fail ho gayi.');
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
            <UserPlus size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Kaam karwana hai?</h1>
          <p className="text-text-secondary">
            Mobile verify karo, phir workers ko hire karo
          </p>
        </div>

        <Card>
          {!verifiedPhone ? (
            <SuperTokensPhonePanel
              onVerified={(phone) => setVerifiedPhone(phone)}
              ctaLabel="Aage badho"
            />
          ) : (
            <div className="space-y-5">
              <div className="rounded-card bg-green-50 px-4 py-3 text-small text-text-primary">
                ✅ Number verify ho gaya:{' '}
                <span className="font-semibold">+91 {verifiedPhone}</span>
              </div>

              <Input
                label="Aapka naam"
                placeholder="Jaise: Bilal Ahmed"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={VALIDATION.NAME_MAX_LENGTH}
                error={nameError ?? undefined}
                autoFocus
              />

              {error && (
                <p className="rounded-button bg-red-50 px-4 py-3 text-small text-danger" role="alert">
                  {error}
                </p>
              )}

              <Button fullWidth size="lg" isLoading={submitting} onClick={handleFinish}>
                Account banao
              </Button>
            </div>
          )}
        </Card>

        <p className="mt-8 text-center text-small text-text-secondary">
          Worker ho?{' '}
          <Link href="/register/worker" className="text-primary-dark font-semibold hover:underline">
            Yahan register karo
          </Link>
        </p>
      </main>

      <Footer />
    </>
  );
}
