import { timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { notifyRevalidate } from "@/ingest/revalidate";
import { runTick } from "@/ingest/tick";

/** Giới hạn của Vercel Hobby (Fluid compute): tối đa 300 giây. */
export const maxDuration = 300;

/** Supabase pg_cron (mỗi 5 phút) và Vercel Cron (dự phòng mỗi ngày) gửi `Authorization: Bearer <CRON_SECRET>`. */
function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Trả lời ngay (pg_net chỉ chờ vài giây), phần việc chạy tiếp sau response trong giới hạn maxDuration
  after(async () => {
    const report = await runTick({ budgetMs: (maxDuration - 45) * 1000 });
    console.log("[tick]", report.skipped ?? `${report.ran.join(", ")} — ${report.changedSlugs.length} phim thay đổi, ${report.durationMs}ms`);
    // Làm mới cache qua request riêng tới /api/revalidate của chính web (xem notifyRevalidate)
    await notifyRevalidate(report.changedSlugs);
  });
  return NextResponse.json({ ok: true, started: true }, { status: 202 });
}

export { handle as GET, handle as POST };
