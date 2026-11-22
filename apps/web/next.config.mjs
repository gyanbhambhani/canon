import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  reactStrictMode: true,
  transpilePackages: ["@canon/compiler", "@canon/runtime"],
  images: { unoptimized: true },
};

export default withMDX(config);
