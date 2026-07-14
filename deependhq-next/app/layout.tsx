import type { Metadata, Viewport } from "next";
import { Nav } from "@/components/client/Nav";
import { Footer } from "@/components/Footer";
import { CommandPalette } from "@/components/client/CommandPalette";
import { Background } from "@/components/client/r6/Background";
import { DH } from "@/lib/data";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://deependhq.com"),
  title: {
    default: "deep >_ Past the hype cycle. Into the infrastructure.",
    template: "%s · deep >_",
  },
  description:
    "Sreedeep Surapaneni. Group CMO at Champions Group. 12 companies, one vault, built in public.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    siteName: "deep >_",
    title: "deep >_ · past the hype cycle, into the infrastructure",
    description:
      "Sreedeep Surapaneni. Group CMO at Champions Group. 12 companies, one vault, built in public.",
  },
  twitter: { card: "summary_large_image" },
  alternates: {
    types: { "application/rss+xml": "/feed.xml" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0D0F14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="dh-app">
          {/* Site-wide dither texture: every page shares the round 6 canvas. */}
          <Background />
          <Nav />
          {/* The home page brings its own <main className="dh5-main">; inner
              pages render inside this wrapper. Avoids nested main elements. */}
          <div className="dh-content">{children}</div>
          <Footer />
          <CommandPalette day={DH.brand.today_day} />
        </div>
      </body>
    </html>
  );
}
