import type { Metadata } from 'next';
import Link from 'next/link';
import { Leaf } from 'lucide-react';
import { Header, Footer } from '@/components';
import { Card } from '@/components/ui';

export const metadata: Metadata = {
  title: 'SahiKaarigar',
  description:
    'SahiKaarigar ke official legal aur support pages — privacy policy, terms, account deletion aur contact.',
  alternates: { canonical: '/' },
};

const PAGES = [
  {
    href: '/privacy',
    title: 'Privacy Policy',
    body: 'Kaunsa data collect hota hai, kaise use hota hai, aur aapke rights.',
  },
  {
    href: '/terms',
    title: 'Terms of Service',
    body: 'Platform use karne ke rules — workers, employers aur reviews.',
  },
  {
    href: '/delete-account',
    title: 'Delete Account',
    body: 'Account app me turant delete karo, ya app ke bina web request bhejo.',
  },
  {
    href: '/contact',
    title: 'Contact Us',
    body: 'Support email, phone/WhatsApp aur grievance officer ki jankari.',
  },
];

// Public landing page. (It used to redirect straight into the internal admin
// panel — a Play reviewer typing the domain landed on an internal tool. The
// admin panel stays reachable at its own /admin URL.)
export default function HomePage() {
  return (
    <>
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white">
            <Leaf size={26} />
          </span>
          <h1 className="text-2xl font-bold">SahiKaarigar</h1>
        </div>
        <p className="text-text-secondary mb-8">
          Hyderabad ke trusted, verified kaarigar — electricians, plumbers,
          painters aur bahut kuch. Neeche hamare legal aur support pages hain;
          app Play Store se download karo.
        </p>

        <div className="space-y-4">
          {PAGES.map((page) => (
            <Link key={page.href} href={page.href} className="block">
              <Card>
                <h2 className="font-semibold mb-1">{page.title}</h2>
                <p className="text-small text-text-secondary">{page.body}</p>
              </Card>
            </Link>
          ))}
        </div>
      </main>

      <Footer />
    </>
  );
}
