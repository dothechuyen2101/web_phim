import { PgBoss } from "pg-boss";
import { db } from "@/lib/db";
import { ensureSyncQueue, SYNC_QUEUE, syncJobKey, type SyncJob } from "./jobs";
import { runSyncJob } from "./runner";
import { ensureSources } from "./sync";

/**
 * Một "nhịp" đồng bộ cho môi trường serverless (Vercel), thay cho worker chạy liên tục.
 * Được gọi định kỳ (Supabase pg_cron mỗi 30 phút → /api/cron/tick) và làm trong giới hạn thời gian:
 *   1. đồng bộ tăng dần mọi nguồn
 *   2. xử lý job trong hàng đợi pg-boss (admin bấm, báo lỗi, tìm nguồn thay thế, backfill từng đợt nhỏ)
 *   3. việc định kỳ khi tới hạn: kiểm tra link (mỗi giờ), thể loại / quốc gia (mỗi ngày)
 */
export interface TickReport {
  skipped?: string;
  ran: string[];
  changedSlugs: string[];
  durationMs: number;
}

const LEASE = "tick";
/** Để dành cho mỗi việc tiếp theo — chưa đủ thì dừng, lượt sau làm tiếp. */
const STEP_RESERVE_MS = 60_000;

/**
 * Giành quyền chạy bằng một câu lệnh nguyên tử (hợp với transaction pooler — không dùng được advisory lock theo phiên).
 * Trả false nếu lượt khác đang giữ khóa và khóa chưa hết hạn.
 */
async function acquireLease(name: string, until: Date): Promise<boolean> {
  const now = new Date();
  const rows = await db.$executeRaw`
    INSERT INTO "CronState" ("name", "lockedUntil") VALUES (${name}, ${until})
    ON CONFLICT ("name") DO UPDATE SET "lockedUntil" = EXCLUDED."lockedUntil"
    WHERE "CronState"."lockedUntil" IS NULL OR "CronState"."lockedUntil" < ${now}`;
  return rows === 1;
}

async function releaseLease(name: string) {
  await db.cronState.update({ where: { name }, data: { lockedUntil: null } });
}

async function isDue(name: string, everyMs: number) {
  const row = await db.cronState.findUnique({ where: { name }, select: { lastRunAt: true } });
  return !row?.lastRunAt || Date.now() - row.lastRunAt.getTime() >= everyMs;
}

async function markRun(name: string) {
  const now = new Date();
  await db.cronState.upsert({ where: { name }, create: { name, lastRunAt: now }, update: { lastRunAt: now } });
}

export async function runTick({ budgetMs = 240_000, log = console.log } = {}): Promise<TickReport> {
  const started = Date.now();
  const deadline = started + budgetMs;
  const hasTime = () => Date.now() < deadline - STEP_RESERVE_MS;
  // Khóa lâu hơn ngân sách một chút: function bị dừng giữa chừng thì khóa tự hết hạn
  if (!(await acquireLease(LEASE, new Date(deadline + 60_000)))) {
    return { skipped: "lượt trước vẫn đang chạy", ran: [], changedSlugs: [], durationMs: Date.now() - started };
  }

  const ran: string[] = [];
  const changed = new Set<string>();
  let boss: PgBoss | null = null;
  try {
    await ensureSources();
    // Chỉ dùng pg-boss làm hàng đợi: không lịch, không giám sát nền (serverless không có tiến trình sống lâu)
    boss = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
      supervise: false,
      schedule: false,
      registerInstance: false,
      max: 1,
    });
    boss.on("error", (error) => log(`pg-boss: ${error instanceof Error ? error.message : String(error)}`));
    await boss.start();
    await ensureSyncQueue(boss);
    // Thay cho giám sát nền: thu hồi job kẹt do function trước bị dừng giữa chừng
    await boss.supervise(SYNC_QUEUE);

    const queue = boss;
    const ctx = {
      enqueue: async (job: SyncJob) => {
        await queue.send(SYNC_QUEUE, { ...job }, { singletonKey: syncJobKey(job) });
      },
      backfillPages: 2,
      incrementalPages: 5,
      log,
    };
    const run = async (label: string, job: SyncJob) => {
      ran.push(label);
      for (const slug of await runSyncJob(job, ctx)) changed.add(slug);
    };

    // 1. Đồng bộ tăng dần — thường chỉ vài giây khi không có gì mới
    await run("incremental", { source: "all", mode: "incremental" });

    // 2. Hàng đợi
    while (hasTime()) {
      const [job] = await queue.fetch<SyncJob>(SYNC_QUEUE);
      if (!job) break;
      try {
        await run(syncJobKey(job.data), job.data);
        await queue.complete(SYNC_QUEUE, job.id);
      } catch (error) {
        log(`job ${syncJobKey(job.data)} lỗi: ${error instanceof Error ? error.message : String(error)}`);
        await queue.fail(SYNC_QUEUE, job.id, { message: error instanceof Error ? error.message : String(error) });
      }
    }

    // 3. Việc định kỳ
    if (hasTime() && (await isDue("check-links", 60 * 60_000))) {
      await run("check-links", { source: "all", mode: "check-links" });
      await markRun("check-links");
    }
    if (hasTime() && (await isDue("taxonomy", 24 * 60 * 60_000))) {
      await run("taxonomy", { source: "all", mode: "taxonomy" });
      await markRun("taxonomy");
    }
  } finally {
    await boss?.stop({ graceful: false, close: true }).catch(() => {});
    await releaseLease(LEASE).catch(() => {});
  }
  return { ran, changedSlugs: [...changed], durationMs: Date.now() - started };
}
