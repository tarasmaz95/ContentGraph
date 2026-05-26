import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AppProviders } from "@/components/layout/app-providers";
import { Nav } from "@/components/layout/nav";
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
  title: "ContentGraph Lite",
  description: "AI analytics for YouTube data from Google Sheets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <AppProviders>
          <Nav />
          <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8 animate-in">
            {children}
          </main>
        </AppProviders>
      </body>
    </html>
  );
}
