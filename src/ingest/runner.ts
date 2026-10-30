import { db } from "@/lib/db";
import { BACKFILL_CHUNK_PAGES, type SyncJob } from "./jobs";
import { checkLinks } from "./links";
import { notifyNewEpisodes } from "./notify";
import { rescueMovie } from "./rescue";
import { syncBackfill, syncIncremental, syncOne, syncTaxonomy, type SyncResult } from "./sync";

/**
 * Chạy một job đồng bộ — dùng chung cho worker chạy liên tục (local / VPS) và tick serverless (Vercel).
 * Trả về slug các phim đã thay đổi để bên gọi làm mới cache.
 */
export interface RunnerContext {
  /** Xếp job tiếp theo (backfill đợt sau, tìm nguồn thay thế…) */
  enqueue: (job: SyncJob) => Promise<void>;
  /** Số trang mỗi đợt backfill (serverless bị giới hạn thời gian nên để nhỏ) */
  backfillPages?: number;
  /** Số trang tối đa mỗi lượt đồng bộ tăng dần */
  incrementalPages?: number;
  log?: (message: string) => void;
}

export async function runSyncJob(job: SyncJob, ctx: RunnerContext): Promise<string[]> {
  const log = ctx.log ?? console.log;

  if (job.mode === "check-links") {
    const result = await checkLinks({ linkIds: job.linkIds });
    log(
      `[links] kiểm tra ${result.checked}: sống ${result.ok}, chết ${result.dead}, chưa rõ ${result.unknown}; ` +
        `cần tìm nguồn thay thế ${result.rescueMovieIds.length} phim`,
    );
    for (const movieId of result.rescueMovieIds) await ctx.enqueue({ source: "all", mode: "rescue", movieId });
    return result.brokenSlugs;
  }
  if (job.mode === "notify") {
    await notifyNewEpisodes({ log });
    return [];
  }
  if (job.mode === "rescue") {
    if (!job.movieId) throw new Error("Job 'rescue' thiếu movieId");
    const result = await rescueMovie(job.movieId, { force: job.force, log });
    log(`[rescue] phim ${job.movieId}: ${result.skippedReason ?? `làm mới ${result.refreshed.join(",") || "—"}, tìm thấy ${result.found.join(",") || "—"}`}`);
    return result.changedSlugs;
  }

  const keys =
    job.source === "all"
      ? (await db.source.findMany({ where: { enabled: true }, orderBy: { priority: "desc" } })).map((s) => s.key)
      : [job.source];
  const changed: string[] = [];
  for (const key of keys) {
    const started = Date.now();
    let result: SyncResult;
    try {
      switch (job.mode) {
        case "incremental":
          result = await syncIncremental(key, { log, maxPages: ctx.incrementalPages });
          break;
        case "taxonomy":
          result = await syncTaxonomy(key, { log });
          break;
        case "one":
          if (!job.slug) throw new Error("Job 'one' thiếu slug");
          result = await syncOne(key, job.slug);
          break;
        case "backfill": {
          result = await syncBackfill(key, { maxPages: ctx.backfillPages ?? BACKFILL_CHUNK_PAGES, restart: job.restart, log });
          const source = await db.source.findUnique({ where: { key }, select: { backfillCursor: true } });
          if (source?.backfillCursor && !result.skippedReason) await ctx.enqueue({ source: key, mode: "backfill" });
          break;
        }
        default:
          throw new Error(`Không biết chế độ đồng bộ "${String(job.mode)}"`);
      }
    } catch (error) {
      // Một nguồn lỗi (đã được tạm dừng trong withRun) không được làm hỏng các nguồn còn lại
      log(`[${key}] ${job.mode} lỗi: ${error instanceof Error ? error.message : String(error)}`);
      if (keys.length === 1) throw error;
      continue;
    }
    const summary = result.skippedReason ?? JSON.stringify(result.stats);
    log(`[${key}] ${job.mode} xong sau ${((Date.now() - started) / 1000).toFixed(1)}s ${summary}`);
    changed.push(...result.changedSlugs);
  }
  return changed;
}
