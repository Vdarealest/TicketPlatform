import type { NextConfig } from "next";
import { API_URL, WS_URL } from "./lib/config";

const apiUrl = API_URL;
const wsUrl = WS_URL;
// wss:// counterpart of the API/WS origin, needed separately in connect-src
// since Socket.IO negotiates over both http(s) and ws(s) schemes.
const wsSocketUrl = wsUrl.replace(/^http/, "ws");

// 'next dev' needs eval() for React's dev-only debugging features (e.g.
// reconstructing component stacks). Without 'unsafe-eval' the browser blocks
// it and React logs a scary-looking (but harmless) console warning — it
// never calls eval() in production, so this stays dev-only and doesn't
// weaken the production CSP below.
const isDev = process.env.NODE_ENV !== "production";

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
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
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
  // Nothing embeds this site; refusing all framing blocks clickjacking.
  "frame-ancestors 'none'",
  // Production only: localhost has no TLS.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
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
          // (CORS headers used to be sent here too. They belong on the API,
          // which sets them in main.ts; nothing calls these pages cross-origin.)
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Full URLs (with event ids, checkout query strings) stay on our
          // origin; other sites only see the origin.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The app never uses these; deny them so injected code can't either.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
        ],
      },
    ];
  },

  // Disable strict mode in dev to avoid double renders
  reactStrictMode: false,
};

export default nextConfig;
