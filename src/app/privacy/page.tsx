import type { Metadata } from 'next';
import Link from 'next/link';
import { Header, Footer } from '@/components';
import { Card } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'SahiKaarigar aapka data kaise collect, use aur protect karta hai - phone privacy, kya share hota hai, aur aapke rights.',
  alternates: { canonical: '/privacy' },
};

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Kaunsa data collect karte hain',
    body: 'Login ke liye mobile number (OTP), aur account ke liye naam. Workers ke liye extra: skills, experience, hourly rate aur service areas. Bas itna hi - hum aapki location ya contacts access nahi karte.',
  },
  {
    title: '2. Phone number privacy',
    body: 'Worker ka phone number platform pe hidden rehta hai. Woh sirf tab dikhta hai jab hire request accept ho jaaye. Isse spam calls se bacha jaata hai.',
  },
  {
    title: '3. Data kab share hota hai',
    body: 'Sirf hire ke waqt - employer aur worker ek doosre ka number dekh sakte hain jab request accept ho. Hum aapka data kisi third-party ko bechte nahi hain.',
  },
  {
    title: '4. Reviews aur feedback',
    body: 'Job complete hone ke baad diye gaye ratings aur reviews platform pe publicly dikhte hain, taake doosre users ko sahi worker chunne me madad mile.',
  },
  {
    title: '5. Security',
    body: 'Data secure cloud database (Supabase) me store hota hai, aur worker profiles admin approval ke baad hi live hote hain.',
  },
  {
    title: '6. Aapke rights',
    body: 'Aap kabhi bhi apna account ya data delete karwa sakte ho. Iske liye Contact page se humse sampark karo.',
  },
];

export default function PrivacyPage() {
  return (
    <>
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-text-secondary mb-8">
          Aakhri update: {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </p>

        <div className="space-y-4">
          {SECTIONS.map((section) => (
            <Card key={section.title}>
              <h2 className="font-semibold mb-2">{section.title}</h2>
              <p className="text-small text-text-secondary">{section.body}</p>
            </Card>
          ))}

          <Card>
            <h2 className="font-semibold mb-2">Sampark</h2>
            <p className="text-small text-text-secondary">
              Privacy ke baare me koi sawal ho to{' '}
              <Link href="/contact" className="text-primary-dark font-semibold hover:underline">
                Contact page
              </Link>{' '}
              se humse poocho.
            </p>
          </Card>
        </div>
      </main>

      <Footer />
    </>
  );
}
