import type { Metadata } from "next";
import { Alegreya, Cinzel, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/layout/site-header";
import "./globals.css";
import { Providers } from "./providers";

const alegreya = Alegreya({
  variable: "--font-alegreya",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mithril Tiles",
  description:
    "A real-time multiplayer drawing and guessing game.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${alegreya.variable} ${cinzel.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
