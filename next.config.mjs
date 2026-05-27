/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warnings and lint errors don't block the production build
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Keep server-only Node.js packages out of the browser bundle.
    // firecrawl-js uses 'undici' which is a Node.js-only HTTP client.
    serverComponentsExternalPackages: [
      "@mendable/firecrawl-js",
      "undici",
      "node-fetch",
      "@supabase/supabase-js",  // supabase client uses WebSocket (undici) at module init — must stay external
    ],
  },
};

export default nextConfig;
