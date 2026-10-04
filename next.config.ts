import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ['127.0.0.1'],
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'microphone=(self), camera=(), geolocation=()' },
    ] }];
  },
};
export default config;
