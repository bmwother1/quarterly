import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The demo route reads this fixture at request time, so it has to travel
  // with the serverless bundle rather than being tree-shaken away.
  outputFileTracingIncludes: {
    '/api/feed': ['./fixtures/**'],
  },
  /* config options here */
};

export default nextConfig;
