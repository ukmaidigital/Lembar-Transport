import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  // Only the driver area is a PWA; the SW scope is restricted via the manifest and registration path.
  additionalPrecacheEntries: [{ url: "/driver", revision: process.env.NEXT_PUBLIC_BUILD_ID ?? Date.now().toString() }],
});

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
};

export default withSerwist(withNextIntl(nextConfig));
