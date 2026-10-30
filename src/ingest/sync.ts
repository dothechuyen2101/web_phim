import type { CrawlKind } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { createAdapter, DEFAULT_SOURCES } from "@/sources";
import { SourceBlockedError } from "@/sources/http";
import type { SourceAdapter, SourceListItem } from "@/sources/types";
import { upsertMovie, type IngestSource } from "./upsert";

export interface SyncStats {
  pages: number;
  checked: number;
  unchanged: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface SyncResult {
  stats: SyncStats;
  changedSlugs: string[];
  /** lý do không chạy (ví dụ nguồn đang tạm dừng) */
  skippedReason?: string;
}

/** Số phim xử lý song song trong một trang (không ảnh hưởng tốc độ gọi API của nguồn). */
const INGEST_CONCURRENCY = 4;

type Log = (message: string) => void;
const defaultLog: Log = (message) => console.log(message);

/** Thời gian tạm dừng nguồn sau lần lỗi thứ n: 15 phút, 30 phút, 1 giờ… tối đa 6 giờ. */
export function pauseDurationMs(failureStreak: number) {
  return Math.min(15 * 60_000 * 2 ** Math.max(0, failureStreak - 1), 6 * 60 * 60_000);
}

/** Thêm các nguồn mặc định nếu chưa có (không ghi đè baseUrl admin đã sửa). */
export async function ensureSources() {
  for (const source of DEFAULT_SOURCES) {
    await db.source.upsert({ where: { key: source.key }, create: { ...source }, update: {} });
  }
}

export async function loadSource(key: string) {
  const source = await db.source.findUnique({ where: { key } });
  if (!source) throw new Error(`Không tìm thấy nguồn "${key}"`);
  return { source, adapter: createAdapter(source) };
}

export const isPaused = (source: { pausedUntil: Date | null }) => !!source.pausedUntil && source.pausedUntil > new Date();

const emptyStats = (): SyncStats => ({ pages: 0, checked: 0, unchanged: 0, created: 0, updated: 0, skipped: 0, failed: 0 });

/**
 * Chạy một lượt đồng bộ có ghi CrawlRun và circuit breaker:
 * nguồn đang tạm dừng thì bỏ qua; lỗi thì tạm dừng nguồn theo cấp số nhân; thành công thì mở lại.
 */
async function withRun(
  source: { id: number; key: string; pausedUntil: Date | null; failureStreak: number },
  kind: CrawlKind,
  work: () => Promise<SyncResult>,
  log: Log,
): Promise<SyncResult> {
  if (isPaused(source)) {
    const reason = `nguồn ${source.key} đang tạm dừng tới ${source.pausedUntil!.toISOString()}`;
    log(`[${source.key}] bỏ qua: ${reason}`);
    return { stats: emptyStats(), changedSlugs: [], skippedReason: reason };
  }
  const run = await db.crawlRun.create({ data: { sourceId: source.id, kind } });
  try {
    const result = await work();
    await db.crawlRun.update({
      where: { id: run.id },
      data: { status: "SUCCESS", finishedAt: new Date(), stats: { ...result.stats } },
    });
    await db.source.update({
      where: { id: source.id },
      data: { lastSyncedAt: new Date(), failureStreak: 0, pausedUntil: null, lastError: null },
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failureStreak = source.failureStreak + 1;
    const pausedUntil = new Date(Date.now() + pauseDurationMs(failureStreak));
    await db.crawlRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), error: message } });
    await db.source.update({ where: { id: source.id }, data: { failureStreak, pausedUntil, lastError: message } });
    log(`[${source.key}] lỗi, tạm dừng nguồn tới ${pausedUntil.toISOString()}: ${message}`);
    throw error;
  }
}

/**
 * Xử lý một trang danh sách: chỉ lấy chi tiết phim có `modified` mới hơn lần lưu trước
 * (`force` = lấy lại tất cả, ví dụ khi cần bổ sung trường mới cho phim cũ). Trả về số phim đã lấy chi tiết.
 */
async function processPage(
  source: IngestSource,
  adapter: SourceAdapter,
  items: SourceListItem[],
  stats: SyncStats,
  changed: Set<string>,
  log: Log,
  force = false,
): Promise<number> {
  const known = await db.movieSource.findMany({
    where: { sourceId: source.id, externalSlug: { in: items.map((i) => i.slug) } },
    select: { externalSlug: true, lastModified: true },
  });
  const lastBySlug = new Map(known.map((k) => [k.externalSlug, k.lastModified]));

  const toFetch: SourceListItem[] = [];
  for (const item of items) {
    stats.checked++;
    const last = lastBySlug.get(item.slug);
    if (!force && last && item.modifiedAt && last >= item.modifiedAt) stats.unchanged++;
    else toFetch.push(item);
  }

  let pageFailures = 0;
  let abort: SourceBlockedError | null = null;
  let next = 0;
  const work = async () => {
    while (next < toFetch.length && !abort) {
      const item = toFetch[next++];
      try {
        const detail = await adapter.getDetail(item.slug);
        if (!detail) {
          stats.skipped++;
          continue;
        }
        // Lưu mốc thời gian của danh sách vì lần sau sẽ so sánh với chính giá trị này
        const result = await upsertMovie(source, detail, item.modifiedAt ?? detail.modifiedAt);
        if (!result) {
          stats.skipped++;
          continue;
        }
        if (result.created) stats.created++;
        else stats.updated++;
        changed.add(result.slug);
      } catch (error) {
        // Nguồn chặn / sập: dừng cả lượt chạy ngay, không gửi tiếp
        if (error instanceof SourceBlockedError) {
          abort = error;
          return;
        }
        stats.failed++;
        pageFailures++;
        log(`  ! ${adapter.key}/${item.slug}: ${error instanceof Error ? error.message : String(error)}`);
        if (pageFailures >= 5 && pageFailures * 2 >= toFetch.length) {
          abort = new SourceBlockedError(adapter.key, `${adapter.key}: quá nhiều phim lỗi trong một trang (${pageFailures})`);
        }
      }
    }
  };
  // Ghi DB song song vài phim một lúc (DB ở xa nên mỗi phim tốn nhiều lượt chờ); gọi API vẫn tuần tự,
  // giãn cách theo giới hạn tốc độ của nguồn trong SourceClient
  await Promise.all(Array.from({ length: Math.min(INGEST_CONCURRENCY, toFetch.length) }, work));
  if (abort) throw abort;
  return toFetch.length;
}

/** Đồng bộ tăng dần: duyệt "mới cập nhật" từ trang 1, dừng khi gặp một trang không có gì thay đổi. */
export async function syncIncremental(key: string, { maxPages = 20, log = defaultLog } = {}): Promise<SyncResult> {
  const { source, adapter } = await loadSource(key);
  return withRun(
    source,
    "INCREMENTAL",
    async () => {
      const stats = emptyStats();
      const changed = new Set<string>();
      for (let page = 1; page <= maxPages; page++) {
        const list = await adapter.listUpdated(page);
        stats.pages++;
        const changedCount = await processPage(source, adapter, list.items, stats, changed, log);
        log(`[${key}] trang ${page}/${list.totalPages}: ${changedCount} phim thay đổi`);
        if (changedCount === 0 || page >= list.totalPages) break;
      }
      return { stats, changedSlugs: [...changed] };
    },
    log,
  );
}

/** Lấy toàn bộ kho phim, lưu con trỏ trang sau mỗi trang để chạy tiếp được nếu bị dừng giữa chừng. */
export async function syncBackfill(
  key: string,
  { maxPages = Number.POSITIVE_INFINITY, restart = false, force = false, log = defaultLog } = {},
): Promise<SyncResult> {
  const { source, adapter } = await loadSource(key);
  return withRun(
    source,
    "BACKFILL",
    async () => {
      const stats = emptyStats();
      const changed = new Set<string>();
      let page = restart ? 1 : (source.backfillCursor ?? 1);
      for (let done = 0; done < maxPages; done++) {
        const list = await adapter.listUpdated(page);
        stats.pages++;
        const changedCount = await processPage(source, adapter, list.items, stats, changed, log, force);
        log(`[${key}] backfill trang ${page}/${list.totalPages}: ${changedCount} phim thay đổi`);
        page++;
        const finished = page > list.totalPages;
        await db.source.update({ where: { id: source.id }, data: { backfillCursor: finished ? null : page } });
        if (finished) break;
      }
      return { stats, changedSlugs: [...changed] };
    },
    log,
  );
}

/** Lấy lại một phim theo slug của nguồn (nút "crawl lại" trong admin, CLI --slug). */
export async function syncOne(key: string, externalSlug: string): Promise<SyncResult> {
  const { source, adapter } = await loadSource(key);
  const stats = emptyStats();
  if (isPaused(source)) return { stats, changedSlugs: [], skippedReason: `nguồn ${key} đang tạm dừng` };
  const detail = await adapter.getDetail(externalSlug);
  const result = detail ? await upsertMovie(source, detail) : null;
  stats.checked = 1;
  if (!result) stats.skipped = 1;
  else if (result.created) stats.created = 1;
  else stats.updated = 1;
  return { stats, changedSlugs: result ? [result.slug] : [] };
}

/** Cập nhật danh sách thể loại / quốc gia (chỉ nguồn có endpoint riêng, hiện là KKPhim). */
export async function syncTaxonomy(key: string, { log = defaultLog } = {}): Promise<SyncResult> {
  const { source, adapter } = await loadSource(key);
  return withRun(
    source,
    "TAXONOMY",
    async () => {
      const stats = emptyStats();
      if (adapter.listTaxonomies) {
        const { genres, countries } = await adapter.listTaxonomies();
        for (const { slug, name } of genres) {
          await db.genre.upsert({ where: { slug }, create: { slug, name }, update: { name } });
        }
        for (const { slug, name } of countries) {
          await db.country.upsert({ where: { slug }, create: { slug, name }, update: { name } });
        }
        stats.updated = genres.length + countries.length;
      }
      return { stats, changedSlugs: [] };
    },
    log,
  );
}
