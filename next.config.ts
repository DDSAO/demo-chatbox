import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Minimal production image for Docker / ECS (see Dockerfile)
  output: "standalone",
};

export default nextConfig;
