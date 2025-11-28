// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",          // ← keep: static export for Cloudflare Pages
  images: { unoptimized: true }, // ← keep: no next/image optimizer in static export
  swcMinify: true,           // ← ensure SWC minification is on
  experimental: {
    legacyBrowsers: false,   // ← drop older browser transforms/polyfills
  },
};

export default nextConfig;
