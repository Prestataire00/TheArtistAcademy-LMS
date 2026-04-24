import type { NextConfig } from 'next';
import fs from 'node:fs';
import path from 'node:path';

// ─── Detection du root de tracing ─────────────────────────────────────────────
// En monorepo local (npm workspaces), `next` est hoisted a la racine et n'est
// pas dans apps/web/node_modules. Turbopack (Next 16) exige turbopack.root
// pour le resoudre. Sur Railway avec Root Directory = apps/web, le container
// n'a pas de parent visible : `next` est directement dans apps/web/node_modules.
// On detecte le contexte au runtime pour choisir le bon root.
const projectDir = __dirname;
const monorepoCandidate = path.join(projectDir, '..', '..');
const isMonorepoContext = fs.existsSync(path.join(monorepoCandidate, 'node_modules', 'next'));
const tracingRoot = isMonorepoContext ? monorepoCandidate : projectDir;

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: tracingRoot,
  turbopack: { root: tracingRoot },
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
