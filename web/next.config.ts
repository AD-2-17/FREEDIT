import type { NextConfig } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const siteHost = site ? new URL(site).host : "";

const nextConfig: NextConfig = {
  // MetaMask's site scanner flags every *.vercel.app address as a wallet drainer (checked 10-12, even unused
  // names), so wallets show a scary warning there. Once the site has its own domain (NEXT_PUBLIC_SITE_URL),
  // anyone arriving on a vercel.app address is sent to it. Temporary (307) in case the domain changes again.
  async redirects() {
    if (!site || !siteHost || siteHost.endsWith(".vercel.app")) return [];
    return [{ source: "/:path*", has: [{ type: "host", value: ".+\\.vercel\\.app" }], destination: `${site.replace(/\/$/, "")}/:path*`, permanent: false }];
  },
};

export default nextConfig;
