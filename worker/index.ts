/**
 * Worker đồng bộ dữ liệu chạy liên tục (máy local / VPS): npm run worker
 * - Khi khởi động và mỗi 5 phút: đồng bộ tăng dần mọi nguồn đang bật (nguồn đang tạm dừng do lỗi sẽ tự bỏ qua).
 *   Lượt không có gì mới chỉ tốn 1 request / nguồn nên chạy dày vẫn nhẹ cho nguồn.
 * - Mỗi giờ (phút 30): kiểm tra link sống/chết, link chết thì tìm nguồn thay thế
 * - 3h sáng mỗi ngày: cập nhật thể loại / quốc gia
 * - Xử lý job do trang admin / người xem gửi (đồng bộ ngay, backfill, crawl lại, tìm nguồn thay thế)
 * Trên Vercel không có tiến trình chạy liên tục: việc này do /api/cron/tick đảm nhận (xem src/ingest/tick.ts).
 */
import "dotenv/config";
import { PgBoss } from "pg-boss";
import { ensureSyncQueue, SYNC_QUEUE, syncJobKey, type SyncJob } from "@/ingest/jobs";
import { notifyRevalidate } from "@/ingest/revalidate";
import { runSyncJob } from "@/ingest/runner";
import { ensureSources } from "@/ingest/sync";
import { db } from "@/lib/db";

const TZ = "Asia/Ho_Chi_Minh";

async function sendJob(boss: PgBoss, job: SyncJob) {
  await boss.send(SYNC_QUEUE, { ...job }, { singletonKey: syncJobKey(job) });
}

async function main() {
  await ensureSources();
  // Pool nhỏ: pooler Supabase giới hạn số kết nối đồng thời cho toàn bộ web + worker
  const boss = new PgBoss({ connectionString: process.env.DATABASE_URL!, instanceName: "worker", max: 3 });
  boss.on("error", (error) => console.error("pg-boss:", error));
  await boss.start();
  await ensureSyncQueue(boss);

  const schedules: [string, string, SyncJob][] = [
    ["incremental", "*/5 * * * *", { source: "all", mode: "incremental" }],
    ["check-links", "30 * * * *", { source: "all", mode: "check-links" }],
    ["taxonomy", "0 3 * * *", { source: "all", mode: "taxonomy" }],
  ];
  for (const [key, cron, job] of schedules) {
    await boss.schedule(SYNC_QUEUE, cron, { ...job }, { key, tz: TZ, singletonKey: syncJobKey(job) });
  }

  await boss.work<SyncJob>(SYNC_QUEUE, { localConcurrency: 1, batchSize: 1 }, async ([job]) => {
    console.log(`→ job ${job.id}: ${syncJobKey(job.data)}`);
    const changed = await runSyncJob(job.data, { enqueue: (next) => sendJob(boss, next) });
    await notifyRevalidate(changed);
  });
  // Vừa khởi động thì bắt kịp ngay, không chờ tới mốc lịch đầu tiên
  await sendJob(boss, { source: "all", mode: "incremental" });
  console.log("Worker đã chạy, đang chờ job…");

  const shutdown = async () => {
    console.log("Đang dừng worker…");
    await boss.stop({ graceful: true, timeout: 30_000 });
    await db.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
