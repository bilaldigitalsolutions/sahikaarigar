'use client';

// =============================================================================
// HeroSearch — the two-field search in the home page hero.
// =============================================================================
//   1) Services dropdown  (name="skill")
//   2) Area input         (name="area") — Google Places Autocomplete
//
// The area field uses the Google Places API when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
// is configured. Without a key it degrades to a plain input backed by a
// <datalist> of known Hyderabad areas, so the form still works offline/static.
//
// Submits a GET request to /search (?skill=...&area=...), which the static
// search page already understands.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { HYDERABAD_AREAS, SKILLS } from '@/constants';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

interface GoogleAutocompleteInstance {
  addListener: (event: string, cb: () => void) => void;
  getPlace: () => { name?: string; formatted_address?: string } | undefined;
}

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          Autocomplete: new (
            input: HTMLInputElement,
            options?: Record<string, unknown>
          ) => GoogleAutocompleteInstance;
        };
      };
    };
    __initSahiKaarigarPlaces?: () => void;
  }
}

export function HeroSearch() {
  const areaInputRef = useRef<HTMLInputElement>(null);
  const [placesReady, setPlacesReady] = useState(false);

  // Load the Google Places library once (only if a key is configured).
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return;
    if (window.google?.maps?.places) {
      setPlacesReady(true);
      return;
    }
    if (document.getElementById('sahikaarigar-google-maps')) return;

    window.__initSahiKaarigarPlaces = () => setPlacesReady(true);

    const script = document.createElement('script');
    script.id = 'sahikaarigar-google-maps';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=__initSahiKaarigarPlaces`;
    document.head.appendChild(script);
  }, []);

  // Attach the Autocomplete widget once the Places library is ready.
  useEffect(() => {
    if (!placesReady || !areaInputRef.current || !window.google?.maps?.places) return;

    const autocomplete = new window.google.maps.places.Autocomplete(areaInputRef.current, {
      componentRestrictions: { country: 'in' },
      fields: ['name', 'formatted_address'],
      types: ['geocode'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const value = place?.name || place?.formatted_address || '';
      if (value && areaInputRef.current) areaInputRef.current.value = value;
    });
  }, [placesReady]);

  return (
    <form action="/search" method="get" className="mt-6 max-w-2xl">
      <div className="flex flex-col gap-2 rounded-2xl border-2 border-green-200 bg-white p-2 shadow-card transition-colors focus-within:border-primary sm:flex-row sm:items-center sm:rounded-full sm:pl-4">
        {/* 1) Services dropdown */}
        <label className="flex flex-1 items-center gap-2 px-2">
          <Search size={20} className="shrink-0 text-text-secondary" />
          <span className="sr-only">Service</span>
          <select
            name="skill"
            defaultValue=""
            aria-label="Select a service"
            className="w-full cursor-pointer bg-transparent py-2.5 text-body text-text-primary outline-none"
          >
            <option value="">All Services</option>
            {SKILLS.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.label}
              </option>
            ))}
          </select>
        </label>

        <span className="hidden h-6 w-px bg-green-100 sm:block" />

        {/* 2) Area — Google Places API (datalist fallback when no key) */}
        <label className="flex flex-1 items-center gap-2 px-2">
          <MapPin size={20} className="shrink-0 text-text-secondary" />
          <span className="sr-only">Area</span>
          <input
            ref={areaInputRef}
            type="text"
            name="area"
            list={GOOGLE_MAPS_API_KEY ? undefined : 'hero-area-options'}
            placeholder="Area (e.g. Ameerpet)"
            aria-label="Enter your area"
            autoComplete="off"
            className="w-full bg-transparent py-2.5 text-body text-text-primary outline-none placeholder:text-gray-400"
          />
        </label>

        <button
          type="submit"
          className="flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-small font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          <Search size={18} /> Search
        </button>
      </div>

      {!GOOGLE_MAPS_API_KEY && (
        <datalist id="hero-area-options">
          {HYDERABAD_AREAS.map((area) => (
            <option key={area.id} value={area.label} />
          ))}
        </datalist>
      )}
    </form>
  );
}
