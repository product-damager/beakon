import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { RoadmapProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "Beakon",
  description: "A calm roadmap workspace where birds are watching YOU 🫵",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Product fonts — Plus Jakarta Sans (titles), Inter (body), Noto Sans Mono (labels). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@500;600;700&family=Noto+Sans+Mono:wght@600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <RoadmapProvider>{children}</RoadmapProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
