/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root: stray lockfiles above this directory otherwise make
  // Next.js (Turbopack, default in 16) infer the wrong root.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
