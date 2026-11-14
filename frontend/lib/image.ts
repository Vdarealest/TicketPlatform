// Resolve an image path stored in the DB to a URL the browser can load.
//
// Three shapes exist in the data:
//   1. Absolute URL ("http://…", "https://…") — Cloudinary uploads or external
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

// Banners are uploaded at full resolution (up to ~600 KB). Cloudinary can
// resize on the fly by putting transformations right after "/upload/":
//   f_auto  — WebP/AVIF for browsers that accept them
//   q_auto  — perceptual quality instead of the original's
//   c_limit — shrink to the width, never enlarge a smaller original
const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)/;

/** URL for showing an image at roughly `width` CSS-independent pixels. */
export function cdnImage(path: string | null | undefined, width: number): string {
  const url = resolveImageUrl(path);
  return url.replace(CLOUDINARY_UPLOAD, `$1f_auto,q_auto,c_limit,w_${width}/`);
}

/**
 * srcset so the browser picks the smallest copy that is sharp on this screen.
 * Undefined for non-Cloudinary images, which only exist in one size.
 */
export function cdnSrcSet(path: string | null | undefined, widths: number[]): string | undefined {
  const url = resolveImageUrl(path);
  if (!CLOUDINARY_UPLOAD.test(url)) return undefined;
  return widths.map((w) => `${cdnImage(path, w)} ${w}w`).join(', ');
}

// Blurred backdrops (blur 18–56px) look identical from a 64px source.
export const BLUR_BACKDROP_WIDTH = 64;
