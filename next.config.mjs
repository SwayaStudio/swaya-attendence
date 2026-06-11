/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@capacitor/core'],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Leaflet uses window — only load on client
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
