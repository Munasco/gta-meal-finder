import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

import { SITE_NAME, SITE_URL } from "@/lib/site";
const TITLE = "Eat Healthier · Healthy delivery across the GTA, ranked for you";
const DESCRIPTION =
  "Type what you feel like eating and get Toronto and GTA delivery options ranked for your biomarkers, diet and budget, with Nutri-Score, AHEI and Health Canada flags on every dish.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s · ${SITE_NAME}` },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "healthy food delivery Toronto",
    "healthy Uber Eats options",
    "healthy takeout GTA",
    "Nutri-Score restaurant meals",
    "low sodium delivery Toronto",
    "high protein delivery Toronto",
    "fatty liver diet takeout",
    "biomarker meal finder",
  ],
  category: "health",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  icons: { icon: [{ url: "/logo.svg", type: "image/svg+xml" }], shortcut: "/logo.svg" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  description: DESCRIPTION,
  applicationCategory: "HealthApplication",
  operatingSystem: "Web",
  browserRequirements: "Requires JavaScript",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "CAD" },
  areaServed: { "@type": "AdministrativeArea", name: "Greater Toronto Area, Ontario, Canada" },
  featureList: [
    "Plain-language meal requests",
    "Biomarker lenses: bilirubin, iron, MASLD, blood pressure, glycemic control",
    "Nutri-Score, Harvard AHEI and Health Canada front-of-pack flags per dish",
    "Cheapest combo per restaurant with BOGO and promo math",
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-CA">
      <body className="min-h-dvh font-sans">
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      </body>
    </html>
  );
}
