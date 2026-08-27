import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['fvdms.lan'],
  output: 'standalone',
};

export default nextConfig;
