import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure ESM packages are transpiled for compatibility
  transpilePackages: ["libphonenumber-js"],
};

export default nextConfig;
