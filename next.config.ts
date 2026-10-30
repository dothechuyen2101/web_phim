import type { NextConfig } from "next";

/** Domain player được phép nhúng (CSP frame-src). Nguồn mới thì thêm vào EMBED_HOSTS. */
const embedHosts = process.env.EMBED_HOSTS ?? "https://player.phimapi.com https://*.streamc.xyz https://*.streamvsmov.com";

const securityHeaders = [
  { key: "Content-Security-Policy", value: `frame-src ${embedHosts}; frame-ancestors 'self'; object-src 'none'; base-uri 'self'` },
  // Gửi origin khi nhúng player: NguonC trả 403 nếu không có Referer
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // standalone chỉ cần cho Docker; Vercel tự đóng gói
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["pg-boss", "pg"],
  // CA của Supabase được đọc lúc chạy (sslrootcert trong DATABASE_URL) nên phải kèm vào mọi function
  outputFileTracingIncludes: {
    "/*": ["./certs/**/*"],
  },
  cacheLife: {
    // Danh mục phim: worker chủ động làm mới qua tag sau mỗi lần đồng bộ, thời gian chỉ là lưới an toàn
    catalog: { stale: 60, revalidate: 300, expire: 86_400 },
  },
  images: {
    // Ảnh nguồn đã là webp nhỏ: trình duyệt tải thẳng từ CDN của nguồn, server không phải
    // resize (tốn CPU) và không bị treo theo khi CDN nguồn chậm
    unoptimized: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
