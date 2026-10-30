/**
 * Đồng bộ thủ công (dev / vận hành):
 *   npm run sync -- --source kkphim --pages 2
 *   npm run sync -- --source all --mode taxonomy
 *   npm run sync -- --source nguonc --mode backfill --pages 50 [--restart] [--force]   (--force: lấy lại cả phim không đổi)
 *   npm run sync -- --source nguonc --slug duoi-day-ho
 *   npm run sync -- --mode check-links [--pages 50]        (số link cần kiểm tra)
 *   npm run sync -- --mode rescue --movie-id 123            (tìm nguồn thay thế, bỏ qua thời gian chờ)
 *   npm run sync -- --mode notify                           (gửi thông báo tập mới ngay)
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import { checkLinks } from "@/ingest/links";
import { notifyNewEpisodes } from "@/ingest/notify";
import { rescueMovie } from "@/ingest/rescue";
import { notifyRevalidate } from "@/ingest/revalidate";
import { ensureSources, syncBackfill, syncIncremental, syncOne, syncTaxonomy } from "@/ingest/sync";
import { db } from "@/lib/db";

const { values } = parseArgs({
  options: {
    source: { type: "string", default: "all" },
    mode: { type: "string", default: "incremental" },
    pages: { type: "string" },
    slug: { type: "string" },
    "movie-id": { type: "string" },
    restart: { type: "boolean", default: false },
    force: { type: "boolean", default: false },
  },
});

async function main() {
  await ensureSources();
  const maxPages = values.pages ? Number(values.pages) : undefined;

  if (values.mode === "check-links") {
    const result = await checkLinks({ limit: maxPages ?? 200 });
    console.log("Kiểm tra link:", result);
    await notifyRevalidate(result.brokenSlugs);
    return;
  }
  if (values.mode === "notify") {
    console.log("Báo tập mới:", await notifyNewEpisodes());
    return;
  }
  if (values.mode === "rescue") {
    const movieId = Number(values["movie-id"]);
    if (!Number.isInteger(movieId)) throw new Error("Cần --movie-id");
    const result = await rescueMovie(movieId, { force: true });
    console.log("Tìm nguồn thay thế:", result);
    await notifyRevalidate(result.changedSlugs);
    return;
  }

  const keys =
    values.source === "all"
      ? (await db.source.findMany({ where: { enabled: true }, orderBy: { priority: "desc" } })).map((s) => s.key)
      : [values.source!];
  for (const key of keys) {
    const started = Date.now();
    const result = values.slug
      ? await syncOne(key, values.slug)
      : values.mode === "taxonomy"
        ? await syncTaxonomy(key)
        : values.mode === "backfill"
          ? await syncBackfill(key, { maxPages, restart: values.restart, force: values.force })
          : await syncIncremental(key, { maxPages });
    console.log(`[${key}] xong sau ${((Date.now() - started) / 1000).toFixed(1)}s`, result.skippedReason ?? result.stats);
    await notifyRevalidate(result.changedSlugs);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
