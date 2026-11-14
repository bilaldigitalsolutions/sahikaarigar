import Link from 'next/link';
import { Leaf } from 'lucide-react';

// Only real pages on this deployment — the old footer linked /search,
// /register/* and /about, which do not exist here (404s on every legal page).
const LEGAL_LINKS = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Delete Account', href: '/delete-account' },
  { label: 'Contact Us', href: '/contact' },
];

const SUPPORT_EMAIL = 'support@sahikaarigar.com';
const GRIEVANCE_EMAIL = 'grievance@sahikaarigar.com';
const SUPPORT_PHONE = '+91 9949363310';

export function Footer() {
  return (
    <footer className="bg-gradient-to-b from-green-950 to-[#04210F] text-green-100/80">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
                <Leaf size={22} />
              </span>
              <span className="text-xl font-bold text-white">SahiKaarigar</span>
            </div>
            <p className="max-w-md text-small leading-relaxed">
              Hyderabad ke trusted workers ka platform. Electricians, plumbers,
              painters aur bahut kuch — sab verified aur rated.
            </p>
            <p className="mt-4 text-caption text-green-200/70">
              Made with ❤️ in Hyderabad
            </p>
          </div>

          {/* Legal & Support — every link resolves; contacts are inline so a
              Play reviewer never needs a second click to reach a human. */}
          <div>
            <h3 className="mb-4 font-semibold text-white">Legal &amp; Support</h3>
            <ul className="space-y-3">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-small transition-colors hover:text-primary-light"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="mt-6 space-y-2 text-caption text-green-200/70">
              <li>
                Support:{' '}
                <a className="underline hover:text-white" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
              </li>
              <li>
                Grievance officer:{' '}
                <a className="underline hover:text-white" href={`mailto:${GRIEVANCE_EMAIL}`}>
                  {GRIEVANCE_EMAIL}
                </a>
              </li>
              <li>
                Phone / WhatsApp:{' '}
                <a className="underline hover:text-white" href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`}>
                  {SUPPORT_PHONE}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 md:flex-row">
          <p className="text-caption text-green-200/70">
            © SahiKaarigar. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-caption text-green-200/70 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
