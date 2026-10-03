import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/pos/admin/secure/control-panel/hm-boutique",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;


