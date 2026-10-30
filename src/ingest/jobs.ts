import { PgBoss } from "pg-boss";

export const SYNC_QUEUE = "sync";

/** Mỗi job backfill xử lý tối đa chừng này trang rồi tự xếp job tiếp theo, để job không chạy quá lâu. */
export const BACKFILL_CHUNK_PAGES = 100;

/**
 * - incremental / backfill / taxonomy / one: đồng bộ từ nguồn
 * - check-links: kiểm tra link sống/chết (định kỳ, hoặc các link cụ thể khi có báo lỗi)
 * - rescue: tìm link thay thế cho một phim có link chết
 */
export type SyncMode = "incremental" | "backfill" | "taxonomy" | "one" | "check-links" | "rescue";

export interface SyncJob {
  /** key của nguồn, hoặc "all" = mọi nguồn đang bật */
  source: string;
  mode: SyncMode;
  slug?: string;
  restart?: boolean;
  movieId?: number;
  linkIds?: number[];
  /** rescue: bỏ qua thời gian chờ giữa hai lần tìm (admin bấm tay) */
  force?: boolean;
}

export const syncJobKey = (job: SyncJob) =>
  [job.source, job.mode, job.slug, job.movieId, job.linkIds?.join(",")].filter((v) => v !== undefined && v !== "").join(":");

export async function ensureSyncQueue(boss: PgBoss) {
  if (!(await boss.getQueue(SYNC_QUEUE))) {
    // stately + singletonKey: mỗi loại job chỉ có tối đa một bản đang chờ và một bản đang chạy
    await boss.createQueue(SYNC_QUEUE, { policy: "stately", expireInSeconds: 2 * 60 * 60, retryLimit: 1 });
  }
}

const globalForBoss = globalThis as unknown as { syncSender?: Promise<PgBoss> };

/** Dùng trong web (trang admin): chỉ gửi job, không chạy lịch hay bảo trì — việc đó của worker. */
function getSender() {
  globalForBoss.syncSender ??= (async () => {
    const boss = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
      supervise: false,
      schedule: false,
      registerInstance: false,
      max: 1,
    });
    boss.on("error", (error) => console.error("pg-boss:", error));
    await boss.start();
    await ensureSyncQueue(boss);
    return boss;
  })();
  return globalForBoss.syncSender;
}

export async function enqueueSync(job: SyncJob) {
  const boss = await getSender();
  return boss.send(SYNC_QUEUE, { ...job }, { singletonKey: syncJobKey(job) });
}
