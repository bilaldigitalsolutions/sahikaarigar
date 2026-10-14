import Link from 'next/link';
import { Leaf } from 'lucide-react';

const FOOTER_STATS = [
  '10,000+ Workers Verified',
  '50,000+ Jobs Completed',
  'Eco-Friendly Commitment',
];

const QUICK_LINKS = [
  { label: 'Search Workers', href: '/search' },
  { label: 'Register as Worker', href: '/register/worker' },
  { label: 'Register as Employer', href: '/register/employer' },
  { label: 'About Us', href: '/about' },
];

const POPULAR_SERVICES = [
  { label: 'Electrician', href: '/search?skill=electrician' },
  { label: 'Plumber', href: '/search?skill=plumber' },
  { label: 'Painter', href: '/search?skill=painter' },
  { label: 'Carpenter', href: '/search?skill=carpenter' },
];

export function Footer() {
  return (
    <footer className="bg-gradient-to-b from-green-950 to-[#04210F] text-green-100/80">
      {/* Stats strip */}
      <div className="border-b border-white/10 bg-white/5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-5 text-center text-small font-semibold text-green-50 sm:px-6 lg:px-8">
          {FOOTER_STATS.map((stat) => (
            <span key={stat} className="flex items-center gap-2">
              <Leaf size={16} className="text-primary-light" /> {stat}
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
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

          {/* Quick Links */}
          <div>
            <h3 className="mb-4 font-semibold text-white">Quick Links</h3>
            <ul className="space-y-3">
              {QUICK_LINKS.map((link) => (
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
          </div>

          {/* Popular Services */}
          <div>
            <h3 className="mb-4 font-semibold text-white">Popular Services</h3>
            <ul className="space-y-3">
              {POPULAR_SERVICES.map((link) => (
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
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 md:flex-row">
          <p className="text-caption text-green-200/70">
            © {new Date().getFullYear()} SahiKaarigar. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            <Link href="/privacy" className="text-caption text-green-200/70 transition-colors hover:text-white">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-caption text-green-200/70 transition-colors hover:text-white">
              Terms of Service
            </Link>
            <Link href="/contact" className="text-caption text-green-200/70 transition-colors hover:text-white">
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

