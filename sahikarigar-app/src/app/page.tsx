import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  Leaf,
  Quote,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { Header, Footer } from '@/components';
import { Button } from '@/components/ui';
import { HeroSearch } from '@/components/HeroSearch';
import { FeaturedWorkers } from '@/components/worker/FeaturedWorkers';
import { SKILLS } from '@/constants';
import { generateSlug } from '@/utils';

const HERO_FEATURES = [
  { label: 'Verified Workers', icon: BadgeCheck },
  { label: 'Eco-Friendly Services', icon: Leaf },
  { label: 'On-Time Guarantee', icon: Clock },
  { label: 'Secure Payment', icon: ShieldCheck },
];

const HOW_IT_WORKS = [
  {
    step: 1,
    title: 'Search Workers',
    description: 'Apni zaroorat ke hisaab se skill aur area select karo',
  },
  {
    step: 2,
    title: 'View Profile',
    description: 'Worker ka profile, ratings aur reviews dekho',
  },
  {
    step: 3,
    title: 'Hire Now',
    description: 'Ek click mein hire request bhejo',
  },
];

const REVIEWS = [
  {
    name: 'Rahul Verma',
    area: 'Ameerpet',
    rating: 5,
    text: 'Electrician 30 minute me aa gaya aur kaam ekdum saaf kiya. Rate bhi theek tha. Zaroor dobara book karunga.',
  },
  {
    name: 'Sneha Reddy',
    area: 'Kukatpally',
    rating: 5,
    text: 'Plumber ne leakage turant fix kiya. Verified worker hone ki wajah se ghar me bulane me koi darr nahi laga.',
  },
  {
    name: 'Imran Khan',
    area: 'Gachibowli',
    rating: 4,
    text: 'Painting ka kaam time pe complete hua aur quality acchi thi. Booking process bahut aasan tha.',
  },
];

/** Hand-drawn green line-art worker with tools + a plant (matches the eco theme). */
function HeroArt() {
  return (
    <svg
      viewBox="0 0 440 340"
      role="img"
      aria-label="SahiKaarigar worker with tools and a plant"
      className="h-auto w-full max-w-md"
    >
      {/* ground */}
      <line x1="36" y1="300" x2="404" y2="300" stroke="#86EFAC" strokeWidth="4" strokeLinecap="round" />

      {/* toolbox */}
      <rect x="52" y="250" width="96" height="50" rx="8" fill="#FFFFFF" stroke="#15803D" strokeWidth="4" />
      <path d="M80 250v-10a20 20 0 0 1 40 0v10" fill="none" stroke="#15803D" strokeWidth="4" strokeLinecap="round" />
      <line x1="52" y1="266" x2="148" y2="266" stroke="#15803D" strokeWidth="3" />
      <rect x="92" y="262" width="16" height="18" rx="3" fill="#22C55E" stroke="#15803D" strokeWidth="3" />

      {/* potted plant */}
      <path d="M318 262h44l-7 38h-30z" fill="#FFFFFF" stroke="#15803D" strokeWidth="4" strokeLinejoin="round" />
      <path d="M340 262v-58" stroke="#15803D" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="322" cy="226" rx="15" ry="8" fill="#22C55E" stroke="#15803D" strokeWidth="3" transform="rotate(-32 322 226)" />
      <ellipse cx="358" cy="234" rx="15" ry="8" fill="#22C55E" stroke="#15803D" strokeWidth="3" transform="rotate(30 358 234)" />
      <ellipse cx="340" cy="200" rx="10" ry="16" fill="#16A34A" stroke="#15803D" strokeWidth="3" />

      {/* legs + shoes */}
      <path d="M198 210l-8 74" stroke="#15803D" strokeWidth="16" strokeLinecap="round" />
      <path d="M224 210l10 74" stroke="#15803D" strokeWidth="16" strokeLinecap="round" />
      <rect x="176" y="278" width="30" height="16" rx="8" fill="#16A34A" stroke="#15803D" strokeWidth="3" />
      <rect x="222" y="278" width="30" height="16" rx="8" fill="#16A34A" stroke="#15803D" strokeWidth="3" />

      {/* body */}
      <rect x="178" y="124" width="66" height="92" rx="24" fill="#22C55E" stroke="#15803D" strokeWidth="4" />

      {/* arms */}
      <path d="M184 152l4 32" stroke="#15803D" strokeWidth="14" strokeLinecap="round" />
      <path d="M240 148l32-28" stroke="#15803D" strokeWidth="14" strokeLinecap="round" />

      {/* clipboard */}
      <rect x="190" y="152" width="44" height="58" rx="6" fill="#FFFFFF" stroke="#15803D" strokeWidth="4" />
      <rect x="204" y="146" width="16" height="12" rx="4" fill="#16A34A" stroke="#15803D" strokeWidth="3" />
      <line x1="198" y1="174" x2="226" y2="174" stroke="#86EFAC" strokeWidth="4" strokeLinecap="round" />
      <line x1="198" y1="188" x2="226" y2="188" stroke="#86EFAC" strokeWidth="4" strokeLinecap="round" />
      <line x1="198" y1="202" x2="216" y2="202" stroke="#86EFAC" strokeWidth="4" strokeLinecap="round" />

      {/* wrench in the raised hand */}
      <path d="M266 130l18-30" stroke="#15803D" strokeWidth="9" strokeLinecap="round" />
      <circle cx="290" cy="92" r="13" fill="#22C55E" stroke="#15803D" strokeWidth="4" />
      <rect x="283" y="84" width="10" height="16" fill="#DCFCE7" />
      <circle cx="271" cy="126" r="10" fill="#15803D" />

      {/* head */}
      <circle cx="211" cy="92" r="30" fill="#FFFFFF" stroke="#15803D" strokeWidth="4" />
      {/* hard hat */}
      <path d="M181 88a30 30 0 0 1 60 0" fill="#16A34A" stroke="#15803D" strokeWidth="4" />
      <rect x="172" y="86" width="78" height="9" rx="4.5" fill="#15803D" />
      {/* face */}
      <circle cx="201" cy="97" r="3" fill="#15803D" />
      <circle cx="221" cy="97" r="3" fill="#15803D" />
      <path d="M203 107q8 7 16 0" fill="none" stroke="#15803D" strokeWidth="3" strokeLinecap="round" />

      {/* decorative sparkles */}
      <path d="M120 120h16M128 112v16" stroke="#86EFAC" strokeWidth="4" strokeLinecap="round" />
      <path d="M392 168h14M399 161v14" stroke="#86EFAC" strokeWidth="4" strokeLinecap="round" />
      <path d="M96 192h12M102 186v12" stroke="#BBF7D0" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <>
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-caption font-semibold text-primary-dark">
                <Leaf size={16} /> Trusted • Eco-Friendly • On-Demand
              </span>

              <h1 className="mt-5 text-3xl font-bold leading-tight text-text-primary md:text-4xl lg:text-5xl">
                Find Skilled Workers You Can Trust
              </h1>

              <p className="mt-4 max-w-xl text-body text-text-secondary">
                Hire verified plumbers, electricians, carpenters, cleaners &amp; more —
                on-demand, eco-friendly services for your home. Safe, reliable, and sustainable.
              </p>

              {/* Search Bar — services dropdown + area (Google Places API) */}
              <HeroSearch />

              {/* Trust features */}
              <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:gap-6">
                {HERO_FEATURES.map(({ label, icon: Icon }) => (
                  <li key={label} className="flex items-center gap-2 text-small font-medium text-text-primary">
                    <Icon size={18} className="shrink-0 text-primary" /> {label}
                  </li>
                ))}
              </ul>
            </div>

            {/* Illustration */}
            <div className="rounded-[2rem] bg-green-100 p-6 sm:p-8">
              <HeroArt />
            </div>
          </div>
        </div>
      </section>

      {/* Browse by Category */}
      <section id="categories" className="bg-white py-16 px-4 scroll-mt-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary">Browse by Category</h2>
            <p className="mt-2 text-text-secondary">Choose from our most popular service categories</p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {SKILLS.slice(0, 8).map((skill) => (
              <Link
                key={skill.id}
                href={`/skills/${generateSlug(skill.id)}`}
                className="group flex items-center gap-4 rounded-2xl border border-green-100 bg-green-50 p-4 transition-all hover:border-green-200 hover:bg-green-100 hover:shadow-card"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
                  {skill.icon}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-text-primary">{skill.label}</span>
                  <span className="block text-caption text-text-secondary">Verified workers</span>
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/search"
              className="inline-flex items-center gap-2 rounded-full border-2 border-primary px-6 py-2.5 text-small font-semibold text-primary-dark transition-colors hover:bg-green-50"
            >
              View all categories <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-gray-50 py-16 px-4 scroll-mt-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <span className="text-2xl font-bold text-primary-dark">{item.step}</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-text-secondary">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Top Rated Workers */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex items-end justify-between gap-4">
            <h2 className="text-2xl md:text-3xl font-bold">Top Rated Workers</h2>
            <Link
              href="/search"
              className="flex items-center gap-2 text-small font-semibold text-primary-dark hover:underline"
            >
              See all workers <ArrowRight size={16} />
            </Link>
          </div>
          <FeaturedWorkers limit={3} />
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-primary-dark to-primary px-4 py-16 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-2xl font-bold md:text-3xl">
            Join Hyderabad&apos;s Growing Worker Community
          </h2>
          <p className="mb-8 text-lg opacity-90">
            Worker ho ya employer - sabke liye kuch hai
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/register/worker">
              <Button size="lg" className="bg-white text-primary-dark hover:bg-gray-100">
                Register as Worker
              </Button>
            </Link>
            <Link href="/register/employer">
              <Button
                size="lg"
                variant="secondary"
                className="border-white text-white hover:bg-white hover:text-primary-dark"
              >
                Hire a Worker
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}


