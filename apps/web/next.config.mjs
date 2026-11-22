/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@canon/compiler", "@canon/runtime"],
};

export default nextConfig;
