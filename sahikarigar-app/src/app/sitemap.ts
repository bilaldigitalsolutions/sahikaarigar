import type { MetadataRoute } from 'next';

// Only the public pages that actually exist on this deployment.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://sahikaarigar.vercel.app';
  const routes = ['', '/privacy', '/terms', '/delete-account', '/contact'];

  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date('2026-11-14'),
    changeFrequency: 'monthly',
    priority: route === '' ? 1 : 0.7,
  }));
}
