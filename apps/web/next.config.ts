import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
];

// GitHub Pages serves a static export under /Life-OS and cannot set response headers.
const pages = process.env.GITHUB_PAGES === "true";

const config: NextConfig = {
  transpilePackages: ["@lifeos/domain"],
  poweredByHeader: false,
  devIndicators: false,
  ...(pages
    ? { output: "export", basePath: "/Life-OS", trailingSlash: true }
    : {
        async headers() {
          return [{ source: "/:path*", headers: securityHeaders }];
        },
      }),
};

export default config;
