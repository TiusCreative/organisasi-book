export const dynamic = 'force-dynamic';

import type { Metadata } from "next";
import "./globals.css";
import DashboardLayout from "../components/DashboardLayout";
import { getCurrentUser } from "../lib/auth";

export const metadata: Metadata = {
  title: "Organisasi Book",
  description: "Sistem Akuntansi & Keuangan untuk Organisasi, Yayasan, dan Perusahaan",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png"
  }
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let currentUser = null

  try {
    currentUser = await getCurrentUser()
  } catch {
    currentUser = null
  }

  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/logo.png" />
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body className="antialiased">
        {/* Membungkus konten dengan Sidebar & Navbar */}
        <DashboardLayout
                currentUser={
            currentUser
              ? {
                  name: currentUser.name,
                  role: currentUser.role,
                  permissions: currentUser.permissions,
                  isPlatformAdmin: currentUser.isPlatformAdmin,
                }
              : null
          }
        >
          {children}
        </DashboardLayout>
      </body>
    </html>
  );
}
