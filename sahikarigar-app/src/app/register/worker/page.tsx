'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Wrench } from 'lucide-react';
import { Header, Footer, SuperTokensPhonePanel, WorkerRegisterForm } from '@/components';
import type { WorkerFormData } from '@/components';
import { Card } from '@/components/ui';
import { useAuth } from '@/components/providers';
import { registerWorkerViaSuperTokens } from '@/lib/supertokens';

export default function RegisterWorkerPage() {
  const router = useRouter();
  const { refresh } = useAuth();

  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(data: WorkerFormData) {
    if (!verifiedPhone) {
      setError('Phone verify nahi hua. Page refresh karke dobara try karo.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await registerWorkerViaSuperTokens({
        name: data.name,
        profile: {
          skills: data.skills,
          experience: data.experience,
          description: data.description || undefined,
          hourlyRate: data.hourlyRate,
          serviceAreas: data.serviceAreas,
        },
      });

      await refresh();
      router.push('/dashboard?registered=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration fail ho gayi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-4">
            <Wrench size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Worker bano</h1>
          <p className="text-text-secondary">
            {verifiedPhone
              ? 'Ab apni details bharo — workers isi se mile rahenge'
              : 'Pehle mobile number verify karo'}
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

              <WorkerRegisterForm
                onSubmit={handleSubmit}
                submitting={submitting}
                serverError={error}
              />
            </div>
          )}
        </Card>

        <p className="mt-8 text-center text-small text-text-secondary">
          Kaam karwana hai?{' '}
          <Link href="/register/employer" className="text-primary-dark font-semibold hover:underline">
            Employer bano
          </Link>
        </p>
      </main>

      <Footer />
    </>
  );
}
