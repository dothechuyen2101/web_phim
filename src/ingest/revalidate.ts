/**
 * Báo web làm mới cache sau khi đồng bộ. Web chưa chạy thì bỏ qua, không làm hỏng job.
 * Trên Vercel không cần đặt WEB_INTERNAL_URL: web tự gọi chính nó qua SITE_URL hoặc domain production.
 */
export async function notifyRevalidate(slugs: string[], log: (message: string) => void = console.log) {
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  const base = process.env.WEB_INTERNAL_URL?.trim() || process.env.SITE_URL?.trim() || vercelUrl;
  const secret = process.env.REVALIDATE_SECRET?.trim();
  if (!base || !secret || slugs.length === 0) return;
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/api/revalidate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-revalidate-secret": secret },
      body: JSON.stringify({ slugs }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) log(`revalidate: web trả về HTTP ${res.status}`);
  } catch (error) {
    log(`revalidate: không gọi được web (${error instanceof Error ? error.message : String(error)})`);
  }
}
