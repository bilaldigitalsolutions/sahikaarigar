import type { MetadataRoute } from 'next';

// Keep the internal admin panel and API routes out of search engines; the
// public legal pages stay indexable.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://sahikaarigar.vercel.app';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/*', '/api'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
