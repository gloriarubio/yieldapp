import type { Metadata, Viewport } from "next";
import { Playfair_Display, DM_Sans, DM_Mono } from "next/font/google";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// Production URL — set NEXT_PUBLIC_SITE_URL in Netlify to your real domain.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://yieldapp-goals.netlify.app";

const title = "Yield — Entiende tu dinero en 2 minutos";
const description =
  "Sube tus extractos bancarios y obtén un dashboard claro con tus ingresos, gastos y capacidad real de ahorro. Con IA conversacional incluida.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s · Yield",
  },
  description,
  applicationName: "Yield",
  keywords: [
    "finanzas personales",
    "extractos bancarios",
    "dashboard financiero",
    "ahorro",
    "presupuesto",
    "IA financiera",
  ],
  authors: [{ name: "Yield" }],
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: siteUrl,
    siteName: "Yield",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#F4EFE5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${playfair.variable} ${dmSans.variable} ${dmMono.variable}`}
    >
      <body className="min-h-screen">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
