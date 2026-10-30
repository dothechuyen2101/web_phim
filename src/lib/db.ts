import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Số kết nối tối đa của mỗi tiến trình. Pooler Supabase (session mode) chỉ cho khoảng 15 kết nối đồng thời
 * cho cả web + worker + pg-boss, nên để nhỏ; tăng qua DB_POOL_MAX nếu dùng Postgres riêng.
 */
const POOL_MAX = Number(process.env.DB_POOL_MAX ?? 5);

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("Thiếu biến môi trường DATABASE_URL");
    // Giữ một client trên globalThis để hot reload ở dev không mở thêm kết nối mới
    globalForPrisma.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: POOL_MAX }) });
  }
  return globalForPrisma.prisma;
}

/**
 * Client chỉ được tạo ở lần truy vấn đầu tiên, nên `next build` (không có DB) vẫn import được module này.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
