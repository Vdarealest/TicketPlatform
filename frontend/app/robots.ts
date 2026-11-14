import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Account, checkout and admin pages are per-user and useless in search.
      disallow: ['/admin', '/checkout', '/profile', '/my-tickets', '/auth', '/events/*/tickets'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
