import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The GraphQL route and the pages both read request state, so nothing is prerendered.
  // That keeps `next build` from needing a database.
  experimental: {},
};

export default config;
