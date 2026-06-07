/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Keep NextAuth.js internal API routes local
      {
        source: '/api/auth/:path*',
        destination: '/api/auth/:path*',
      },
      // Proxy all other /api/* calls to the NestJS backend
      {
        source: '/api/:path*',
        destination: `${process.env.API_BASE_URL || 'http://localhost:3001'}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
