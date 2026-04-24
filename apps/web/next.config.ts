import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Rewrites : proxifie les appels API vers le backend Express en dev
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
