import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
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
      </body>
    </html>
  );
}
