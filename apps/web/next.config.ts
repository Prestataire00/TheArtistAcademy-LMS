import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Trace racine monorepo pour que le build standalone inclue les bons fichiers
  outputFileTracingRoot: path.join(__dirname, '../../'),
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
