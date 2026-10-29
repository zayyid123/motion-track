import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "motion-track — Isometric Animated Sticker Studio",
  description: "Minimalist Swiss-inspired design studio for creating animated isometric slab stickers with role-based palettes, After Effects keyframe motions, custom AI chat, and video exports.",
};

// Google Analytics 4 (gtag.js). Set NEXT_PUBLIC_GA_ID in .env.local to enable;
// when the variable is empty the tag is not rendered at all and the app runs
// without any third-party request. See README › Analytics.
const gaId = process.env.NEXT_PUBLIC_GA_ID?.trim();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Browser extensions (Grammarly, ColorZilla, …) inject attributes such as
          data-gr-ext-installed or cz-shortcut-listen into <body> before React
          hydrates. Suppressing the warning on this element is the documented
          fix and does not hide real mismatches in children. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
      </body>
    </html>
  );
}
