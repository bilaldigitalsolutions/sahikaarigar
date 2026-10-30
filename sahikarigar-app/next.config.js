/** @type {import('next').NextConfig} */

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/^https?:\/\//, '')
  : null;

const imageDomains = [
  'firebasestorage.googleapis.com',
  ...(supabaseHost ? [supabaseHost] : []),
];

/**
 * SERVER MODE ONLY. This app is deployed on Vercel and MUST keep its Route
 * Handlers: the admin panel's same-origin session proxy lives in
 * src/app/api/admin/[...path]/route.ts and requires a server.
 *
 * Do NOT add `output: 'export'` here — it would silently drop every
 * src/app/api/**\/route.ts file and break the admin panel session
 * (the old Firebase static deploy did exactly that, and is now retired).
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
