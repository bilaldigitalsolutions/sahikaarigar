import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MapPin, MessageCircle } from 'lucide-react';
import { Header, Footer } from '@/components';
import { Card, Button } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'SahiKaarigar se sampark karo - sawal, feedback ya support ke liye email karo ya Hyderabad office me milo.',
  alternates: { canonical: '/contact' },
};

const SUPPORT_EMAIL = 'support@sahikaarigar.com';

export default function ContactPage() {
  return (
    <>
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-2">Contact Us</h1>
        <p className="text-text-secondary mb-8">
          Koi sawal, feedback ya support chahiye? Hum sunte hain.
        </p>

        <div className="space-y-4">
          <Card>
            <div className="flex items-start gap-3">
              <Mail size={20} className="text-primary-dark mt-0.5 shrink-0" />
              <div>
                <h2 className="font-semibold mb-1">Email</h2>
                <p className="text-small text-text-secondary mb-2">
                  Support, feedback ya account se judi koi baat ke liye likho.
                </p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-primary-dark font-semibold hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-3">
              <MapPin size={20} className="text-primary-dark mt-0.5 shrink-0" />
              <div>
                <h2 className="font-semibold mb-1">Location</h2>
                <p className="text-small text-text-secondary">
                  Hyderabad, Telangana, India
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-3">
              <MessageCircle size={20} className="text-primary-dark mt-0.5 shrink-0" />
              <div>
                <h2 className="font-semibold mb-1">Worker ya employer ho?</h2>
                <p className="text-small text-text-secondary mb-4">
                  Registration ke liye neeche ke buttons use karo - free hai.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/register/worker">
                    <Button size="sm" fullWidth>
                      Worker registration
                    </Button>
                  </Link>
                  <Link href="/register/employer">
                    <Button size="sm" variant="secondary" fullWidth>
                      Employer registration
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>

      <Footer />
    </>
  );
}
