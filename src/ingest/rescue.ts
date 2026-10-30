import { db } from "@/lib/db";
import { createAdapter } from "@/sources";
import { slugify, tmdbKey, tmdbRefFromKey } from "@/sources/normalize";
import type { NormalizedMovie, SourceSearchHit } from "@/sources/types";
import { isPaused } from "./sync";
import { upsertMovie } from "./upsert";

/** Không chạy lại "tìm nguồn thay thế" cho cùng một phim trong khoảng này. */
export const RESCUE_COOLDOWN_MS = 6 * 60 * 60_000;

export interface RescueResult {
  refreshed: string[];
  found: string[];
  changedSlugs: string[];
  skippedReason?: string;
}

interface Target {
  originName: string;
  year: number | null;
  tmdbKey: string | null;
}

/** Cùng phim: khớp TMDB nếu hai bên đều có; nếu không thì tên gốc + năm (bắt buộc có năm để tránh ghép nhầm). */
export function sameMovie(target: Target, candidate: { originName: string; year: number | null; tmdbKey: string | null }) {
  if (target.tmdbKey && candidate.tmdbKey) return target.tmdbKey === candidate.tmdbKey;
  const name = slugify(target.originName);
  return !!name && name === slugify(candidate.originName) && !!target.year && target.year === candidate.year;
}

const hitMatches = (target: Target, hit: SourceSearchHit) =>
  sameMovie(target, { originName: hit.originName, year: hit.year, tmdbKey: tmdbKey(hit.tmdb) });

const detailMatches = (target: Target, movie: NormalizedMovie) =>
  sameMovie(target, { originName: movie.originName, year: movie.year, tmdbKey: tmdbKey(movie.tmdb) });

/**
 * Tìm link thay thế cho phim có link chết:
 * 1. lấy lại phim từ các nguồn đang liên kết (nguồn hay thay link mới cho tập cũ);
 * 2. tìm phim ở các nguồn khác — theo TMDB nếu nguồn hỗ trợ, rồi theo tìm kiếm tên gốc.
 */
export async function rescueMovie(movieId: number, { force = false, log = console.log } = {}): Promise<RescueResult> {
  const movie = await db.movie.findUnique({
    where: { id: movieId },
    select: {
      id: true, slug: true, originName: true, name: true, year: true, tmdbKey: true, rescuedAt: true,
      sources: { select: { externalSlug: true, source: true } },
    },
  });
  const result: RescueResult = { refreshed: [], found: [], changedSlugs: [] };
  if (!movie) return { ...result, skippedReason: "không có phim" };
  if (!force && movie.rescuedAt && Date.now() - movie.rescuedAt.getTime() < RESCUE_COOLDOWN_MS) {
    return { ...result, skippedReason: "vừa tìm gần đây" };
  }
  await db.movie.update({ where: { id: movieId }, data: { rescuedAt: new Date() } });
  const target: Target = { originName: movie.originName, year: movie.year, tmdbKey: movie.tmdbKey };

  // 1. Nguồn đang liên kết
  for (const { externalSlug, source } of movie.sources) {
    if (!source.enabled || isPaused(source)) continue;
    try {
      const detail = await createAdapter(source).getDetail(externalSlug);
      if (detail && (await upsertMovie(source, detail, detail.modifiedAt, movieId))) result.refreshed.push(source.key);
    } catch (error) {
      log(`[rescue] ${source.key}/${externalSlug}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 2. Nguồn chưa liên kết
  const linked = new Set(movie.sources.map((s) => s.source.id));
  const others = await db.source.findMany({ where: { enabled: true, id: { notIn: [...linked] } }, orderBy: { priority: "desc" } });
  const ref = tmdbRefFromKey(movie.tmdbKey);
  for (const source of others) {
    if (isPaused(source)) continue;
    const adapter = createAdapter(source);
    try {
      let detail: NormalizedMovie | null = null;
      if (ref && adapter.findByTmdb) detail = await adapter.findByTmdb(ref);
      if (!detail && adapter.search) {
        for (const keyword of [movie.originName, movie.name].filter(Boolean)) {
          const hit = (await adapter.search(keyword)).find((h) => hitMatches(target, h));
          if (hit) {
            detail = await adapter.getDetail(hit.slug);
            break;
          }
        }
      }
      if (detail && detailMatches(target, detail) && (await upsertMovie(source, detail, detail.modifiedAt, movieId))) {
        result.found.push(source.key);
        log(`[rescue] ${movie.slug}: tìm thấy ở ${source.key} (${detail.externalSlug})`);
      }
    } catch (error) {
      log(`[rescue] ${source.key} tìm "${movie.originName}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (result.refreshed.length + result.found.length > 0) result.changedSlugs = [movie.slug];
  return result;
}
