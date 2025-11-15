import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'comic-fusion.s3.ap-southeast-2.amazonaws.com',
        port: '',
        pathname: '/examples/**',
      },
    ],
  },
};

export default nextConfig;
