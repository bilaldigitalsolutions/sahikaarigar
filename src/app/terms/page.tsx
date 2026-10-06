import type { Metadata } from 'next';
import Link from 'next/link';
import { Header, Footer } from '@/components';
import { Card } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'SahiKaarigar use karne ke terms - users ki zimmedariyan, worker verification, reviews aur acceptable use.',
  alternates: { canonical: '/terms' },
};

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Service ka istemaal',
    body: 'SahiKaarigar ek platform hai jo workers aur employers ko milaata hai. Hum khud koi kaam nahi karte, aur kisi bhi job ki quality ya completion ki guarantee nahi dete.',
  },
  {
    title: '2. Account aur verification',
    body: 'Sahi number se login karo. Worker profiles admin approval ke baad hi search me dikhte hain. Fake ya galat information dene par account block ho sakta hai.',
  },
  {
    title: '3. Workers ki zimmedari',
    body: 'Worker apni skills, experience aur rate ki sahi jaankari dene ka zimmedar hai. Kaam agreed rate aur time ke hisaab se poora karna expected hai.',
  },
  {
    title: '4. Employers ki zimmedari',
    body: 'Employer ko sahi kaam ka description aur location dena chahiye. Kaam poora hone ke baad review dena encourage kiya jaata hai.',
  },
  {
    title: '5. Reviews aur ratings',
    body: 'Reviews honest hone chahiye. Fake, abusive ya misleading reviews hata diye jaayenge.',
  },
  {
    title: '6. Acceptable use',
    body: 'Harassment, spam, fake profiles ya galat behaviour allowed nahi hai. Aise users ko report karo - hum action lenge.',
  },
  {
    title: '7. Payments',
    body: 'Abhi payment platform ke bahar, worker aur employer ke beech direct hoti hai. SahiKaarigar kisi bhi transaction ka hissa nahi hai.',
  },
];

export default function TermsPage() {
  return (
    <>
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-2">Terms of Service</h1>
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
              In terms ke baare me koi sawal ho to{' '}
              <Link href="/contact" className="text-primary-dark font-semibold hover:underline">
                Contact page
              </Link>{' '}
              dekho.
            </p>
          </Card>
        </div>
      </main>

      <Footer />
    </>
  );
}
