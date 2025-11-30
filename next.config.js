// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for Cloudflare Pages
  output: "export",

  // You’re not using next/image’s optimizer, so keep this
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
