import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The browser bridge (public/bridge.js) posts captured menus from ubereats.com to /api/ingest.
  allowedDevOrigins: ["www.ubereats.com", "ubereats.com"],
  // Snapshot mode (Vercel): ship the crawl dataset and estimates with the API functions.
  outputFileTracingIncludes: {
    "/api/find": ["./data/ubereats-gta.json", "./data/health-estimates.json"],
    "/api/ubereats": ["./data/ubereats-gta.json", "./data/health-estimates.json"],
  },
  // The original address stays up and sends everything (pages and API) to the new home.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "gta-meal-finder.vercel.app" }],
        destination: "https://eat-healthier.vercel.app/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
