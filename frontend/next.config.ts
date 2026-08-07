import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const wsUrl = process.env.NEXT_PUBLIC_WS_URL || apiUrl;
// wss:// counterpart of the API/WS origin, needed separately in connect-src
// since Socket.IO negotiates over both http(s) and ws(s) schemes.
const wsSocketUrl = wsUrl.replace(/^http/, "ws");

// This app stores its JWT in localStorage (see lib/api.ts) rather than an
// httpOnly cookie — a deliberate, tracked tradeoff, not an oversight. CSP is
// the main compensating control: even if a script ever got injected, a
// tightly-scoped connect-src blocks it from exfiltrating the token to any
// origin outside this list, and script-src blocks loading attacker scripts
// from a foreign host in the first place.
const csp = [
  "default-src 'self'",
  // Next.js ships inline bootstrap scripts; strict nonce-based CSP would
  // remove the need for 'unsafe-inline' here but requires per-request nonce
  // wiring across the App Router — tracked as a follow-up, not done here.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // Event banners are admin-uploaded from the backend, plus Google avatar
  // images and the VietQR image service.
  `img-src 'self' data: ${apiUrl} https://lh3.googleusercontent.com https://img.vietqr.io https://res.cloudinary.com`,
  "font-src 'self' data:",
  // The real exfiltration choke point: fetch/XHR/WebSocket can only reach
  // our own API and socket origin, nowhere an injected script could send
  // stolen data to.
  `connect-src 'self' ${[...new Set([apiUrl, wsUrl, wsSocketUrl])].join(' ')}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

const nextConfig: NextConfig = {
  reactCompiler: true,

  headers: async () => {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
          // Enable CORS headers for backend communication
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: apiUrl,
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,OPTIONS,PATCH,DELETE,POST,PUT",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
          },
        ],
      },
    ];
  },

  // Disable strict mode in dev to avoid double renders
  reactStrictMode: false,
};

export default nextConfig;
