// Resolve an image path stored in the DB to a URL the browser can load.
//
// Three shapes exist in the data:
//   1. Absolute URL ("http://…", "https://…") — legacy uploads or external
//      images. Returned as-is.
//   2. Backend upload path ("/uploads/…") — prepend the API base so it works
//      regardless of which host the frontend is served from.
//   3. Bare filename ("blackpink.jpg") — a seed asset shipped in /public/img.
//
// Storing relative "/uploads/…" (not an absolute localhost URL) is what lets the
// site work once deployed to a real domain.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function resolveImageUrl(
  path?: string | null,
  fallback = '/img/placeholder.jpg',
): string {
  if (!path) return fallback;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/uploads/')) return `${API_BASE}${path}`;
  return `/img/${path}`;
}
