// Public origin of the frontend, used for canonical URLs, Open Graph and the
// sitemap. Set NEXT_PUBLIC_SITE_URL for a custom domain; on Vercel the
// production domain is provided automatically.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3001');

export const SITE_NAME = 'Vietix';
