import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GTA Meal Finder",
  description:
    "Describe what you want to eat and a budget. Microsoft Decision-1 reads the request, Uber Eats menus are searched, and dishes are ranked for health and biomarker fit.",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
