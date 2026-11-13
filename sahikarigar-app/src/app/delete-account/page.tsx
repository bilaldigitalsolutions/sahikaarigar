import type { Metadata } from 'next';
import Link from 'next/link';
import { Header, Footer } from '@/components';
import { Card } from '@/components/ui';

import { DeleteRequestForm } from './DeleteRequestForm';

export const metadata: Metadata = {
  title: 'Delete Account',
  description:
    'SahiKaarigar account delete kaise karein - app me turant delete, ya app ke bina web request form se. Kya data delete hota hai, poori jankari.',
  alternates: { canonical: '/delete-account' },
};

const IN_APP_STEPS = [
  'SahiKaarigar app kholo aur Profile tab me jao.',
  'Neeche "Delete Account" button dabao.',
  'Confirmation pe "Delete" choose karo — bas, itna hi.',
];

export default function DeleteAccountPage() {
  return (
    <>
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-2">Delete Account</h1>
        <p className="text-text-secondary mb-8">
          Apna SahiKaarigar account kabhi bhi delete kar sakte ho — bina kisi sawal
          ya charge ke. Do tarike hain: app me turant delete (sabse fast), ya app
          install kiye bina neeche wala web form.
        </p>

        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold mb-2">1. App se turant delete karo (sabse aasaan)</h2>
            <ol className="list-decimal list-inside space-y-1 text-small text-text-secondary">
              {IN_APP_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="text-small text-text-secondary mt-3">
              Delete dabate hi account aur uska data turant remove ho jata hai aur
              aap login screen pe pahunch jate ho. Koi waiting period nahi.
            </p>
          </Card>

          <div id="web-request">
            <h2 className="font-semibold mb-2">2. App ke bina delete request</h2>
            <DeleteRequestForm />
          </div>

          <Card>
            <h2 className="font-semibold mb-2">Delete hone pe kya remove hota hai</h2>
            <p className="text-small text-text-secondary">
              Aapki poori identity: naam, mobile number, location, job history
              (aapke diye aur aapko mile dono), saare reviews, reports aur feedback.
              Worker account ho to worker profile, skills aur uploaded documents
              (Aadhaar photo, profile photo) bhi storage se delete hoti hain.
              Delete hone ke baad wo number bilkul fresh signup ki tarah dobara use
              ho sakta hai.
            </p>
          </Card>

          <Card>
            <h2 className="font-semibold mb-2">Sawal ho to</h2>
            <p className="text-small text-text-secondary">
              Deletion, data ya privacy ke baare me koi aur sawal ho to{' '}
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
