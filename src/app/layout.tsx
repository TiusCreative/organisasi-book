export const dynamic = 'force-dynamic';

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Organisasi Book",
  description: "Sistem Akuntansi & Keuangan untuk Organisasi, Yayasan, dan Perusahaan",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/logo.png" />
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
