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
    body: 'Login ke liye mobile number (OTP), aur account ke liye naam. Workers ke liye skills, experience, hourly rate aur service areas ke saath verification ke liye Aadhaar image aur optional profile photo collect hoti hai — plus kaam ke samples (work photos). Employer aur worker dono ke liye location data (area/city, aur job ke time GPS location) collect hota hai taake aas-paas ke kaarigar dhoondh sake aur kaam track ho. Push notifications bhejne ke liye device ka push token save hota hai. Aadhaar image private storage me rakhi jaati hai aur sirf worker verification ke liye admin dekh sakte hain; yeh public profile par nahi dikhai jaati. Hum aapke contacts access nahi karte.',
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
    body: 'Data Supabase me store hota hai. Aadhaar images private bucket me rakhi jaati hain aur admin review ke liye temporary, expiring link se dikhai jaati hain. Worker profiles admin approval ke baad hi live hote hain.',
  },
  {
    title: '6. Aapke rights',
    body: 'Aap kabhi bhi apna account ya data delete karwa sakte ho — app ke Profile tab se turant delete ho jata hai, ya app ke bina /delete-account page se request bhej sakte ho. Web request ka jawab hum 7 din ke andar dete hain, aur poori deletion bhi usi window me complete karne ki koshish karte hain.',
  },
];

export default function PrivacyPage() {
  return (
    <>
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-text-secondary mb-8">
          {/* Hardcoded policy date — a new Date() here changes every build,
              which makes the policy look "updated" when it is not. */}
          Aakhri update: November 2026
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
              se poocho, ya seedha email karo:{' '}
              <a className="text-primary-dark font-semibold hover:underline" href="mailto:support@sahikaarigar.com">
                support@sahikaarigar.com
              </a>{' '}
              · Grievance officer:{' '}
              <a className="text-primary-dark font-semibold hover:underline" href="mailto:grievance@sahikaarigar.com">
                grievance@sahikaarigar.com
              </a>
            </p>
          </Card>
        </div>
      </main>

      <Footer />
    </>
  );
}
