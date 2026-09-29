import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A stray ~/package-lock.json otherwise makes Next.js pick the home folder as the workspace root.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
