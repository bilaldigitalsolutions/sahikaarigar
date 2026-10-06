import Link from 'next/link';
import { Search, ArrowRight } from 'lucide-react';
import { Header, Footer, Button } from '@/components';
import { FeaturedWorkers } from '@/components/worker/FeaturedWorkers';
import { SKILLS, HYDERABAD_AREAS } from '@/constants';
import { generateSlug } from '@/utils';

export default function HomePage() {
  return (
    <>
      <Header />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-dark to-primary-light text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Hyderabad ke Best Workers Dhundho
          </h1>
          <p className="text-lg md:text-xl mb-8 opacity-90">
            Verified electricians, plumbers, painters & more
          </p>

          {/* Search Bar — GET form so the selected skill/area reach /search */}
          <form action="/search" method="get" className="max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                name="skill"
                aria-label="Skill"
                className="flex-1 px-4 py-3 rounded-button text-text-primary text-body"
              >
                <option value="">Select Skill</option>
                {SKILLS.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.icon} {skill.label}
                  </option>
                ))}
              </select>
              <select
                name="area"
                aria-label="Area"
                className="flex-1 px-4 py-3 rounded-button text-text-primary text-body"
              >
                <option value="">Select Area</option>
                {HYDERABAD_AREAS.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.label}
                  </option>
                ))}
              </select>
              <Button
                type="submit"
                size="lg"
                className="w-full sm:w-auto bg-white text-primary-dark hover:bg-gray-100"
              >
                <Search size={20} className="mr-2" />
                Search
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* Popular Categories */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">
            Popular Categories
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {SKILLS.slice(0, 6).map((skill) => (
              <Link
                key={skill.id}
                href={`/skills/${generateSlug(skill.id)}`}
                className="flex flex-col items-center gap-3 p-4 rounded-card bg-white shadow-card hover:shadow-card-hover transition-shadow"
              >
                <span className="text-3xl">{skill.icon}</span>
                <span className="text-small font-medium text-text-primary">
                  {skill.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Search Workers</h3>
              <p className="text-text-secondary">
                Apni zaroorat ke hisaab se skill aur area select karo
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">View Profile</h3>
              <p className="text-text-secondary">
                Worker ka profile, ratings aur reviews dekho
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Hire Now</h3>
              <p className="text-text-secondary">
                Ek click mein hire request bhejo
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Workers */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Top Rated Workers</h2>
            <Link href="/search" className="flex items-center gap-2 text-primary-dark hover:underline">
              View All <ArrowRight size={16} />
            </Link>
          </div>
          <FeaturedWorkers limit={3} />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-primary-dark text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Join Hyderabad&apos;s Growing Worker Community
          </h2>
          <p className="text-lg mb-8 opacity-90">
            Worker ho ya employer - sabke liye kuch hai
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register/worker">
              <Button size="lg" className="bg-white text-primary-dark hover:bg-gray-100">
                Register as Worker
              </Button>
            </Link>
            <Link href="/register/employer">
              <Button size="lg" variant="secondary" className="border-white text-white hover:bg-white hover:text-primary-dark">
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