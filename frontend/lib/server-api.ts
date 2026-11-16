import { cache } from 'react';
import type { EventDetail } from './types';
import { API_URL } from './config';

// Server-side reads for metadata, the event page's first render and the
// sitemap. The backend runs on Render's free tier, which can take ~20s to
// wake up; a page must never hang on that, so every call gives up quickly and
// returns null, and the page falls back to fetching in the browser.
const API = API_URL;
const TIMEOUT_MS = 4000;

async function getJson<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      next: { revalidate },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// cache(): generateMetadata and the page both ask for the same event during
// one request; this makes it a single backend call.
export const getEvent = cache((id: string) => getJson<EventDetail>(`/events/${encodeURIComponent(id)}`, 60));

export const getEvents = () => getJson<EventDetail[]>('/events', 600);
