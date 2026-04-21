declare module "next-pwa" {
  type NextConfig = Record<string, unknown>

  export default function withPWAInit(config: Record<string, unknown>): (nextConfig: NextConfig) => NextConfig
}
