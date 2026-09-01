import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Photo payloads: 50 images at 1280px/JPEG-0.82 lands around 8–10MB of base64.
  experimental: {
    serverActions: { bodySizeLimit: "24mb" },
  },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
