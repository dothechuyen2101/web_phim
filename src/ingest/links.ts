import Bottleneck from "bottleneck";
import { db } from "@/lib/db";

/** Số người khác nhau báo lỗi một link trong 24h thì tự đánh dấu hỏng. */
export const REPORT_THRESHOLD = 3;
/** Số lần kiểm tra liên tiếp thấy link chết thì đánh dấu hỏng (tránh đánh nhầm do lỗi mạng thoáng qua). */
const DEAD_CHECKS_TO_BREAK = 2;

const USER_AGENT = `WebPhimLinkCheck/1.0 (+${process.env.SITE_URL ?? "http://localhost:3000"})`;
const probeLimiter = new Bottleneck({ maxConcurrent: 4, minTime: 150 });

export type LinkHealth = "ok" | "dead" | "unknown";

/**
 * Kiểm tra luồng m3u8 gốc còn sống không. Chỉ kết luận "dead" khi chắc chắn (404/410 hoặc không phải playlist);
 * lỗi mạng, timeout, 403, 5xx đều là "unknown" để không đánh hỏng nhầm.
 */
export async function probeStream(url: string): Promise<LinkHealth> {
  try {
    const res = await probeLimiter.schedule(() =>
      fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(12_000) }),
    );
    if (res.status === 404 || res.status === 410) return "dead";
    if (!res.ok) return "unknown";
    const head = (await res.text()).slice(0, 512).trimStart();
    return head.startsWith("#EXTM3U") ? "ok" : "dead";
  } catch {
    return "unknown";
  }
}

/**
 * Đánh dấu link hỏng. Trả về id các phim mà tập bị ảnh hưởng không còn link nào xem được
 * — cần "tìm nguồn thay thế".
 */
export async function markLinksBroken(linkIds: number[]): Promise<{ movieIds: number[]; slugs: string[] }> {
  if (linkIds.length === 0) return { movieIds: [], slugs: [] };
  await db.episodeLink.updateMany({ where: { id: { in: linkIds } }, data: { broken: true } });
  const episodes = await db.episode.findMany({
    where: { links: { some: { id: { in: linkIds } } } },
    select: {
      movieId: true,
      movie: { select: { slug: true } },
      _count: { select: { links: { where: { broken: false, source: { enabled: true } } } } },
    },
  });
  return {
    movieIds: [...new Set(episodes.filter((e) => e._count.links === 0).map((e) => e.movieId))],
    slugs: [...new Set(episodes.map((e) => e.movie.slug))],
  };
}

/** Sau mỗi báo lỗi: đủ số người khác nhau báo trong 24h thì tự đánh dấu link hỏng. */
export async function applyReportThreshold(linkId: number) {
  const reporters = await db.report.findMany({
    where: { episodeLinkId: linkId, resolved: false, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } },
    distinct: ["reporterHash"],
    select: { reporterHash: true },
  });
  if (reporters.length < REPORT_THRESHOLD) return null;
  return markLinksBroken([linkId]);
}

export interface LinkCheckResult {
  checked: number;
  ok: number;
  dead: number;
  unknown: number;
  brokenSlugs: string[];
  rescueMovieIds: number[];
}

/**
 * Kiểm tra định kỳ các link có m3u8 gốc, ưu tiên phim được xem nhiều và link lâu chưa kiểm tra.
 * Link chỉ có trang nhúng (không có m3u8) không được dò tự động — các host nhúng có WAF và dễ chặn IP
 * máy chủ; những link đó dựa vào báo lỗi của người xem.
 */
export async function checkLinks({ limit = 200, linkIds }: { limit?: number; linkIds?: number[] } = {}): Promise<LinkCheckResult> {
  const staleBefore = new Date(Date.now() - 24 * 60 * 60_000);
  const links = await db.episodeLink.findMany({
    where: linkIds
      ? { id: { in: linkIds }, streamUrl: { not: null } }
      : { broken: false, streamUrl: { not: null }, OR: [{ checkedAt: null }, { checkedAt: { lt: staleBefore } }] },
    orderBy: [{ episode: { movie: { viewCount: "desc" } } }, { checkedAt: { sort: "asc", nulls: "first" } }],
    take: limit,
    select: { id: true, streamUrl: true, failCount: true },
  });

  const result: LinkCheckResult = { checked: 0, ok: 0, dead: 0, unknown: 0, brokenSlugs: [], rescueMovieIds: [] };
  const toBreak: number[] = [];
  await Promise.all(
    links.map(async (link) => {
      const health = await probeStream(link.streamUrl!);
      result.checked++;
      result[health]++;
      const failCount = health === "dead" ? link.failCount + 1 : health === "ok" ? 0 : link.failCount;
      await db.episodeLink.update({ where: { id: link.id }, data: { checkedAt: new Date(), failCount } });
      if (failCount >= DEAD_CHECKS_TO_BREAK) toBreak.push(link.id);
    }),
  );
  const { movieIds, slugs } = await markLinksBroken(toBreak);
  result.brokenSlugs = slugs;
  result.rescueMovieIds = movieIds;
  return result;
}
