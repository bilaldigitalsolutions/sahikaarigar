/** @type {import('next').NextConfig} */

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/^https?:\/\//, '')
  : null;

const imageDomains = [
  'firebasestorage.googleapis.com',
  ...(supabaseHost ? [supabaseHost] : []),
];

/**
 * SERVER MODE ONLY. Route handlers in src/app/api require a server (this app
 * builds for Vercel / Node). Do NOT add `output: 'export'` — it silently drops
 * every src/app/api/**\/route.ts file.
 */
const nextConfig = {
  // Enable React Strict Mode
  reactStrictMode: true,

  images: {
    domains: imageDomains,
    formats: ['image/avif', 'image/webp'],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
