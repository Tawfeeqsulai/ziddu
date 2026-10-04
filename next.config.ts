import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./prisma/ca.pem"],
  },
};

export default nextConfig;
