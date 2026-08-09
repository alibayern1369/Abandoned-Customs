import type { NextConfig } from 'next';
import { loadEnvConfig } from '@next/env';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
loadEnvConfig(rootDir);

const nextConfig: NextConfig = {
  transpilePackages: ['@metrookeh/db', '@metrookeh/domain', '@metrookeh/import-core'],
  serverExternalPackages: ['postgres', 'xlsx'],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;
