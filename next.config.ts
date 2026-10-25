import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The browser bridge (public/bridge.js) posts captured menus from ubereats.com to /api/ingest.
  allowedDevOrigins: ["www.ubereats.com", "ubereats.com"],
  // Snapshot mode (Vercel): ship the crawl dataset and estimates with the API functions.
  outputFileTracingIncludes: {
    "/api/find": ["./data/ubereats-gta.json", "./data/health-estimates.json"],
    "/api/ubereats": ["./data/ubereats-gta.json", "./data/health-estimates.json"],
  },
};

export default nextConfig;
