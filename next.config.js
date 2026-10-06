/** @type {import('next').NextConfig} */
const isStaticExport = process.env.STATIC_EXPORT === '1';

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/^https?:\/\//, '')
  : null;

const imageDomains = [
  'firebasestorage.googleapis.com',
  ...(supabaseHost ? [supabaseHost] : []),
];

/**
 * Static export mode (`npm run build:static`) produces the `out/` folder that
 * Firebase Hosting serves on the FREE Spark plan — no Cloud Functions, so no
 * Blaze plan is required.
 *
 * `pageExtensions` deliberately omits `ts`, which makes Next ignore the
 * `route.ts` files in src/app/api (Route Handlers are not supported by
 * `output: "export"`). Those files stay in the repo for when this app is
 * deployed somewhere with a server (Vercel, Cloud Run, ...).
 */
const staticExportConfig = {
  output: 'export',
  trailingSlash: true,
  pageExtensions: ['tsx', 'jsx', 'js', 'mdx'],
  images: {
    unoptimized: true,
    domains: imageDomains,
  },
};

const serverConfig = {
  images: {
    domains: imageDomains,
    formats: ['image/avif', 'image/webp'],
  },
  // Security headers (mirrored in firebase.json for the static deploy)
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React Strict Mode
  reactStrictMode: true,

  ...(isStaticExport ? staticExportConfig : serverConfig),
};

module.exports = nextConfig;
