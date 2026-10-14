import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Header, Footer } from '@/components';
import { Card, Button } from '@/components/ui';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'SahiKaarigar Hyderabad ka platform hai jo verified local workers ko employers se seedha jodta hai - bina middleman, koi commission nahi.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <>
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-2">About SahiKaarigar</h1>
        <p className="text-text-secondary mb-8">
          Hyderabad ke trusted workers ka platform.
        </p>

        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold mb-2">Humara Mission</h2>
            <p className="text-small text-text-secondary">
              Local workers ko bina kisi middleman ke seedha employers se jodna.
              Workers ko apna sahi rate mile, aur employers ko bharosa karne
              layak, verified log mile - bas itna hi.
            </p>
          </Card>

          <Card>
            <h2 className="font-semibold mb-3">Workers ke liye</h2>
            <ul className="space-y-2">
              {[
                'Apna profile banao - skills, experience aur area ke saath',
                'Admin approve karega, phir verified badge milega',
                'Seedha kaam ke requests pao - koi commission nahi',
                'Apna rate khud set karo',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-small text-text-secondary">
                  <CheckCircle2 size={18} className="text-success mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="font-semibold mb-3">Employers ke liye</h2>
            <ul className="space-y-2">
              {[
                'Skill aur area ke hisaab se workers dhundho',
                'Ratings aur reviews dekho, phir decide karo',
                'Ek click me hire request bhejo',
                'Phone number hire accept hone ke baad hi milta hai',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-small text-text-secondary">
                  <CheckCircle2 size={18} className="text-success mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="font-semibold mb-2">Bharosa aur Suraksha</h2>
            <p className="text-small text-text-secondary">
              Har worker profile ko admin manually approve karta hai. Worker ka
              phone number tab tak hidden rehta hai jab tak hire accept na ho.
              Isse dono taraf privacy aur safety banti hai.
            </p>
          </Card>

          <Card>
            <h2 className="font-semibold mb-2">Kahan available hain</h2>
            <p className="text-small text-text-secondary">
              Phase 1 me poora Hyderabad - Ameerpet, Kukatpally, Gachibowli,
              Hitech City, Madhapur, Secunderabad samet 20+ areas.
            </p>
          </Card>

          <Card>
            <div className="text-center space-y-4 py-2">
              <h2 className="font-semibold">SahiKaarigar join karo</h2>
              <p className="text-small text-text-secondary">
                Worker ho ya employer - dono ke liye free hai.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/register/worker">
                  <Button fullWidth>Worker hu</Button>
                </Link>
                <Link href="/register/employer">
                  <Button variant="secondary" fullWidth>
                    Kaam karwana hai
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>

        <p className="text-caption text-text-secondary text-center mt-8">
          Made with ❤️ in Hyderabad, India
        </p>
      </main>

      <Footer />
    </>
  );
}
