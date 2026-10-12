import type { NextConfig } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const siteHost = site ? new URL(site).host : "";

const nextConfig: NextConfig = {
  // Basic browser protections: no framing by other sites (clickjacking), no MIME sniffing, links and labels in the
  // address bar (share links carry the title and names) aren't sent to other sites, and no camera/mic/location.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  // MetaMask's site scanner flags every *.vercel.app address as a wallet drainer (checked 10-12, even unused
  // names), so wallets show a scary warning there. Once the site has its own domain (NEXT_PUBLIC_SITE_URL),
  // anyone arriving on a vercel.app address is sent to it. Temporary (307) in case the domain changes again.
  async redirects() {
    if (!site || !siteHost || siteHost.endsWith(".vercel.app")) return [];
    return [{ source: "/:path*", has: [{ type: "host", value: ".+\\.vercel\\.app" }], destination: `${site.replace(/\/$/, "")}/:path*`, permanent: false }];
  },
};

export default nextConfig;
