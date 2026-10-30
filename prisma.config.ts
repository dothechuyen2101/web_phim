import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Cả dự án dùng một DATABASE_URL theo cú pháp node-postgres:
 *   ...?sslmode=verify-full&sslrootcert=certs/supabase-ca.crt
 * Prisma CLI (migrate) hiểu tham số khác: đường dẫn CA của server là `sslcert` (tuyệt đối cho chắc)
 * và `sslmode=require` (mặc định `sslaccept=strict` vẫn xác thực chứng chỉ).
 */
function forPrismaCli(url: string | undefined) {
  if (!url) return url;
  const parsed = new URL(url);
  const rootCert = parsed.searchParams.get("sslrootcert");
  if (rootCert) {
    parsed.searchParams.delete("sslrootcert");
    parsed.searchParams.set("sslcert", path.resolve(rootCert).replace(/\\/g, "/"));
    parsed.searchParams.set("sslmode", "require");
  }
  return parsed.toString();
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrate cần session mode (khóa advisory theo phiên): DIRECT_URL là session pooler 5432.
    // DATABASE_URL trên Vercel là transaction pooler 6543, không dùng được cho migrate.
    url: forPrismaCli(process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"]),
  },
});
