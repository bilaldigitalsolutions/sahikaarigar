import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🔧</span>
              <span className="text-xl font-bold text-white">
                SahiKaarigar
              </span>
            </div>
            <p className="text-small mb-4">
              Hyderabad ke trusted workers ka platform. 
              Electricians, plumbers, painters aur bahut kuch - 
              sab verified aur rated.
            </p>
            <p className="text-caption text-gray-500">
              Made with ❤️ in Hyderabad
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/search" className="hover:text-white transition-colors">
                  Search Workers
                </Link>
              </li>
              <li>
                <Link href="/register/worker" className="hover:text-white transition-colors">
                  Register as Worker
                </Link>
              </li>
              <li>
                <Link href="/register/employer" className="hover:text-white transition-colors">
                  Register as Employer
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Popular Services */}
          <div>
            <h3 className="text-white font-semibold mb-4">Popular Services</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/search?skill=electrician" className="hover:text-white transition-colors">
                  Electrician
                </Link>
              </li>
              <li>
                <Link href="/search?skill=plumber" className="hover:text-white transition-colors">
                  Plumber
                </Link>
              </li>
              <li>
                <Link href="/search?skill=painter" className="hover:text-white transition-colors">
                  Painter
                </Link>
              </li>
              <li>
                <Link href="/search?skill=carpenter" className="hover:text-white transition-colors">
                  Carpenter
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-caption text-gray-500">
              © {new Date().getFullYear()} SahiKaarigar. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link href="/privacy" className="text-caption text-gray-500 hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-caption text-gray-500 hover:text-white transition-colors">
                Terms of Service
              </Link>
              <Link href="/contact" className="text-caption text-gray-500 hover:text-white transition-colors">
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}