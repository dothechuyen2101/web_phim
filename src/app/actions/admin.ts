"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { MovieStatus, MovieType } from "@/generated/prisma/enums";
import { enqueueSync, type SyncMode } from "@/ingest/jobs";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { MOVIE_DETAIL_TAG, MOVIES_TAG, movieTag } from "@/lib/queries";
import type { FormState } from "./auth";

function invalidateMovie(slug: string) {
  updateTag(MOVIES_TAG);
  updateTag(movieTag(slug));
}

export async function setMovieHidden(movieId: number, hidden: boolean) {
  await requireAdmin();
  const movie = await db.movie.update({ where: { id: movieId }, data: { hidden }, select: { slug: true } });
  invalidateMovie(movie.slug);
  refresh();
}

const movieSchema = z.object({
  name: z.string().trim().min(1).max(300),
  originName: z.string().trim().max(300),
  description: z.string().trim().max(10_000),
  posterUrl: z.union([z.url(), z.literal("")]),
  thumbUrl: z.union([z.url(), z.literal("")]),
  type: z.enum(MovieType),
  status: z.enum(MovieStatus),
  year: z.union([z.coerce.number().int().min(1900).max(2100), z.literal("")]),
});

export async function updateMovie(movieId: number, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = movieSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const { posterUrl, thumbUrl, year, ...rest } = parsed.data;
  const movie = await db.movie.update({
    where: { id: movieId },
    data: { ...rest, posterUrl: posterUrl || null, thumbUrl: thumbUrl || null, year: year === "" ? null : year },
    select: { slug: true },
  });
  invalidateMovie(movie.slug);
  return { message: "Đã lưu. Lưu ý: lần đồng bộ sau từ nguồn chính có thể ghi đè các trường này." };
}

export async function setLinkBroken(linkId: number, broken: boolean) {
  await requireAdmin();
  const link = await db.episodeLink.update({
    where: { id: linkId },
    data: broken ? { broken } : { broken, failCount: 0 },
    select: { episode: { select: { movie: { select: { slug: true } } } } },
  });
  invalidateMovie(link.episode.movie.slug);
  refresh();
}

export async function resolveReport(reportId: number) {
  await requireAdmin();
  await db.report.update({ where: { id: reportId }, data: { resolved: true } });
  refresh();
}

/** Báo lỗi: đánh dấu link hỏng và đóng mọi báo lỗi của link đó. */
export async function resolveReportAsBroken(reportId: number) {
  await requireAdmin();
  const report = await db.report.findUnique({ where: { id: reportId }, select: { episodeLinkId: true } });
  if (report?.episodeLinkId) {
    await setLinkBroken(report.episodeLinkId, true);
    await db.report.updateMany({ where: { episodeLinkId: report.episodeLinkId }, data: { resolved: true } });
  } else {
    await db.report.update({ where: { id: reportId }, data: { resolved: true } });
  }
  refresh();
}

const httpUrl = z.url().refine((v) => v.startsWith("https://") || v.startsWith("http://"));
const sourceSchema = z.object({
  baseUrl: httpUrl,
  priority: z.coerce.number().int().min(0).max(100),
  enabled: z.literal("on").optional(),
  mirrors: z
    .string()
    .optional()
    .transform((v) => (v ?? "").split(/\s+/).filter(Boolean))
    .pipe(z.array(httpUrl).max(10)),
});

export async function updateSource(sourceId: number, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = sourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "baseUrl, mirror hoặc độ ưu tiên không hợp lệ." };
  const trim = (url: string) => url.replace(/\/+$/, "");
  await db.source.update({
    where: { id: sourceId },
    data: {
      baseUrl: trim(parsed.data.baseUrl),
      mirrors: parsed.data.mirrors.map(trim),
      priority: parsed.data.priority,
      enabled: !!parsed.data.enabled,
    },
  });
  // Bật/tắt nguồn và độ ưu tiên ảnh hưởng danh sách server của mọi phim
  updateTag(MOVIE_DETAIL_TAG);
  refresh();
  return { message: "Đã lưu." };
}

/** Bỏ trạng thái tạm dừng (circuit breaker) để nguồn được đồng bộ lại ngay. */
export async function resumeSource(sourceId: number) {
  await requireAdmin();
  await db.source.update({ where: { id: sourceId }, data: { pausedUntil: null, failureStreak: 0 } });
  refresh();
}

/** Tìm link thay thế cho phim ngay (bỏ qua thời gian chờ giữa hai lần tìm). */
export async function rescueNow(movieId: number) {
  await requireAdmin();
  await enqueueSync({ source: "all", mode: "rescue", movieId, force: true });
  refresh();
}

/** Kiểm tra ngay các link có m3u8 gốc của phim. */
export async function checkMovieLinks(movieId: number) {
  await requireAdmin();
  const links = await db.episodeLink.findMany({
    where: { episode: { movieId }, streamUrl: { not: null } },
    select: { id: true },
    take: 500,
  });
  if (links.length > 0) await enqueueSync({ source: "all", mode: "check-links", linkIds: links.map((l) => l.id) });
  refresh();
}

export async function triggerSync(
  sourceKey: string,
  mode: Exclude<SyncMode, "one" | "rescue" | "check-links">,
  restart = false,
) {
  await requireAdmin();
  await enqueueSync({ source: sourceKey, mode, restart });
  refresh();
}

export async function resyncMovie(movieId: number) {
  await requireAdmin();
  const links = await db.movieSource.findMany({
    where: { movieId },
    select: { externalSlug: true, source: { select: { key: true } } },
  });
  for (const link of links) {
    await enqueueSync({ source: link.source.key, mode: "one", slug: link.externalSlug });
  }
  refresh();
}

export async function setTakedownStatus(requestId: number, status: "DONE" | "REJECTED" | "PENDING") {
  await requireAdmin();
  await db.takedownRequest.update({
    where: { id: requestId },
    data: { status, handledAt: status === "PENDING" ? null : new Date() },
  });
  refresh();
}

/** Ẩn mọi phim có đường dẫn /phim/<slug> hoặc /xem/<slug>/… xuất hiện trong yêu cầu gỡ. */
export async function hideMoviesFromTakedown(requestId: number) {
  await requireAdmin();
  const request = await db.takedownRequest.findUnique({ where: { id: requestId }, select: { urls: true } });
  if (!request) return;
  const slugs = [...request.urls.matchAll(/\/(?:phim|xem)\/([a-z0-9-]+)/g)].map((m) => m[1]);
  if (slugs.length > 0) {
    await db.movie.updateMany({ where: { slug: { in: slugs } }, data: { hidden: true } });
    for (const slug of new Set(slugs)) invalidateMovie(slug);
  }
  await db.takedownRequest.update({ where: { id: requestId }, data: { status: "DONE", handledAt: new Date() } });
  refresh();
}
