"use server";

import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function toggleFavorite(movieId: number): Promise<{ favorited: boolean } | { error: "login" }> {
  const session = await getSession();
  if (!session) return { error: "login" };
  const where = { userId_movieId: { userId: session.userId, movieId } };
  if (await db.favorite.findUnique({ where })) {
    await db.favorite.delete({ where });
    return { favorited: false };
  }
  await db.favorite.create({ data: { userId: session.userId, movieId } });
  return { favorited: true };
}

/** Gọi khi mở trang xem: tăng lượt xem (client tự chống lặp trong phiên) và lưu lịch sử nếu đã đăng nhập. */
export async function recordWatch(slug: string, episodeKey: string, countView: boolean) {
  const movie = await db.movie.findUnique({ where: { slug }, select: { id: true } });
  if (!movie) return;
  if (countView) await db.movie.update({ where: { id: movie.id }, data: { viewCount: { increment: 1 } } });
  const session = await getSession();
  if (!session) return;
  await db.watchHistory.upsert({
    where: { userId_movieId: { userId: session.userId, movieId: movie.id } },
    create: { userId: session.userId, movieId: movie.id, episodeKey: episodeKey.slice(0, 50) },
    update: { episodeKey: episodeKey.slice(0, 50), updatedAt: new Date() },
  });
}

const localHistory = z
  .array(z.object({ slug: z.string().max(200), episodeKey: z.string().max(50), at: z.number() }))
  .max(100);

/** Gộp lịch sử xem lúc chưa đăng nhập (localStorage) vào tài khoản; chỉ ghi khi bản local mới hơn. */
export async function mergeHistory(items: unknown) {
  const session = await getSession();
  const parsed = localHistory.safeParse(items);
  if (!session || !parsed.success || parsed.data.length === 0) return;

  const movies = await db.movie.findMany({
    where: { slug: { in: parsed.data.map((i) => i.slug) } },
    select: { id: true, slug: true },
  });
  const idBySlug = new Map(movies.map((m) => [m.slug, m.id]));
  const existing = await db.watchHistory.findMany({
    where: { userId: session.userId, movieId: { in: movies.map((m) => m.id) } },
    select: { movieId: true, updatedAt: true },
  });
  const updatedByMovie = new Map(existing.map((e) => [e.movieId, e.updatedAt.getTime()]));

  for (const item of parsed.data) {
    const movieId = idBySlug.get(item.slug);
    if (!movieId || (updatedByMovie.get(movieId) ?? 0) >= item.at) continue;
    const updatedAt = new Date(Math.min(item.at, Date.now()));
    await db.watchHistory.upsert({
      where: { userId_movieId: { userId: session.userId, movieId } },
      create: { userId: session.userId, movieId, episodeKey: item.episodeKey, updatedAt },
      update: { episodeKey: item.episodeKey, updatedAt },
    });
  }
}

export async function removeHistory(movieId: number) {
  const session = await getSession();
  if (!session) return;
  await db.watchHistory.deleteMany({ where: { userId: session.userId, movieId } });
}
