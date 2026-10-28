import type { NextConfig } from "next";
const apiUrl = process.env.API_URL ?? "http://127.0.0.1:3001";
if (!/^https?:\/\//.test(apiUrl))
  throw new Error("API_URL must be an HTTP(S) URL");
const releaseScope = process.env.RELEASE_SCOPE ?? "core";
if (releaseScope !== "core" && releaseScope !== "preview")
  throw new Error("RELEASE_SCOPE must be core or preview");
const config: NextConfig = {
  env: { NEXT_PUBLIC_RELEASE_SCOPE: releaseScope },
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: [
    "@168hours/contracts",
    "@168hours/api-client",
    "@168hours/domain-utils",
  ],
  async rewrites() {
    return [{ source: "/api/:path*", destination: apiUrl + "/api/:path*" }];
  },
};
export default config;
