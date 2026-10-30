import { headers } from "next/headers";

/** Giới hạn tần suất đơn giản trong bộ nhớ — đủ cho một tiến trình web trên một VPS. */
const buckets = new Map<string, { count: number; resetAt: number }>();

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Trả về true nếu còn được phép; false nếu đã vượt `limit` lần trong `windowMs`. */
export async function rateLimit(action: string, limit: number, windowMs: number): Promise<boolean> {
  const key = `${action}:${await clientIp()}`;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return true;
  }
  bucket.count++;
  return bucket.count <= limit;
}
