// The one place the frontend learns where the backend lives.
// NEXT_PUBLIC_* values are inlined at build time (set them on Vercel).

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Socket.IO runs on the same NestJS server unless told otherwise.
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || API_URL;

/**
 * Absolute URL for something the backend serves by path, e.g. an avatar at
 * "/uploads/avatars/x.png". Absolute URLs (Cloudinary, Google) pass through.
 */
export function backendUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path}`;
}
