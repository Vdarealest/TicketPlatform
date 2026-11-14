import type { Metadata } from "next";
import { Be_Vietnam_Pro, Bebas_Neue } from "next/font/google";
import "./globals.css";
import "./custom.css";
import LayoutShell from '@/components/layout/LayoutShell';
import { SITE_NAME, SITE_URL } from '@/lib/site';

// Primary UI font — full Vietnamese diacritics (U+1EA0–1EF9) drawn natively,
// so mixed-font "ế/ộ/ữ" fallback glyphs disappear.
const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Display face for the "Vietix" logo only (latin text).
const bebas = Bebas_Neue({
  variable: "--font-bebas-neue",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  // Lets pages use relative URLs for canonical / og:image.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Đặt vé sự kiện, concert, chọn ghế trực tuyến`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Đặt vé concert, sân khấu và sự kiện tại Việt Nam. Chọn ghế trên sơ đồ, giữ chỗ 5 phút và thanh toán qua VNPay, MoMo.",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "vi_VN",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${beVietnam.variable} ${bebas.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.setAttribute('data-theme','dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
