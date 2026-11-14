import type { MetadataRoute } from 'next';
import { getEvents } from '@/lib/server-api';
import { SITE_URL } from '@/lib/site';

// Regenerated at most every 10 minutes (see getEvents). If the backend is
// asleep, the sitemap still lists the static pages rather than failing.
export const revalidate = 600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = (await getEvents()) ?? [];
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/events`, changeFrequency: 'daily', priority: 0.9 },
    ...events.map((e) => ({
      url: `${SITE_URL}/events/${e.id}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    { url: `${SITE_URL}/faq`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/contact`, changeFrequency: 'monthly', priority: 0.3 },
  ];
}
