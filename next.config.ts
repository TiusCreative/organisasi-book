import withPWAInit from "next-pwa";
import type { NextConfig } from "next";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // WAJIB: Agar Prisma tidak rusak saat proses bundling Vercel
  serverExternalPackages: ["@prisma/client", ".prisma"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withPWA(nextConfig);
