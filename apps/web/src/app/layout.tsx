import type { Metadata } from "next";
import { Inter, Instrument_Serif, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

// Brand font for the demo client (Pushpam Infra tokens.json) — used in post previews
const playfair = Playfair_Display({
  variable: "--font-playfair",
  weight: ["600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bolo Studio — Speak once. Ship everywhere.",
  description:
    "Speak a content idea. AI agents write, design, make reels and brand-check it. Your client approves on Telegram. It goes live on Instagram, Facebook, LinkedIn and YouTube.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Font variables live on <html> so the @theme tokens in globals.css can resolve them at :root
    <html lang="en" className={`${inter.variable} ${instrument.variable} ${playfair.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
