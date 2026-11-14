import type { Metadata } from 'next';
import { Header, Footer } from '@/components';
import { Card } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'SahiKaarigar support se sampark karein — email, phone/WhatsApp aur grievance officer ki poori jankari.',
  alternates: { canonical: '/contact' },
};

const SUPPORT_EMAIL = 'support@sahikaarigar.com';
const GRIEVANCE_EMAIL = 'grievance@sahikaarigar.com';
const SUPPORT_PHONE = '+91 9949363310';

export default function ContactPage() {
  return (
    <>
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-2">Contact Us</h1>
        <p className="text-text-secondary mb-8">
          Koi bhi sawal, complaint ya feedback ho to humse seedha sampark karo.
          Hum generally 1-2 working days me jawab dete hain.
        </p>

        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold mb-2">General support</h2>
            <p className="text-small text-text-secondary mb-3">
              App, booking ya account ke sawal:
            </p>
            <ul className="space-y-2 text-small">
              <li>
                Email:{' '}
                <a className="text-primary-dark font-semibold hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
              </li>
              <li>
                Phone / WhatsApp:{' '}
                <a className="text-primary-dark font-semibold hover:underline" href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`}>
                  {SUPPORT_PHONE}
                </a>
              </li>
            </ul>
          </Card>

          <Card>
            <h2 className="font-semibold mb-2">Grievance officer (DPDP)</h2>
            <p className="text-small text-text-secondary mb-3">
              Data, privacy ya account deletion se judi shikayat ke liye:
            </p>
            <ul className="space-y-2 text-small">
              <li>
                Email:{' '}
                <a className="text-primary-dark font-semibold hover:underline" href={`mailto:${GRIEVANCE_EMAIL}`}>
                  {GRIEVANCE_EMAIL}
                </a>
              </li>
              <li className="text-text-secondary">Mohammad Bilal — Hyderabad, Telangana, India</li>
            </ul>
          </Card>

          <Card>
            <h2 className="font-semibold mb-2">Aur kya dekh sakte ho</h2>
            <ul className="space-y-2 text-small">
              <li>
                <a className="text-primary-dark font-semibold hover:underline" href="/privacy">
                  Privacy Policy
                </a>{' '}
                — kaunsa data kaise use hota hai
              </li>
              <li>
                <a className="text-primary-dark font-semibold hover:underline" href="/delete-account">
                  Delete Account
                </a>{' '}
                — app se turant, ya app ke bina web request se
              </li>
              <li>
                <a className="text-primary-dark font-semibold hover:underline" href="/terms">
                  Terms of Service
                </a>
              </li>
            </ul>
          </Card>
        </div>
      </main>

      <Footer />
    </>
  );
}
