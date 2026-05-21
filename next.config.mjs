/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warnings and lint errors don't block the production build
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
