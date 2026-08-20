/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    // Allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Optional: ignores TypeScript errors during build if needed
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;