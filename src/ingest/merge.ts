import { db } from "@/lib/db";

export interface DuplicatePair {
  keepId: number;
  keepSlug: string;
  dropId: number;
  dropSlug: string;
  tmdbKey: string;
}

/**
 * Cặp phim trùng do nguồn không ghi số mùa TMDB ("tv:id:0") nằm cạnh bản có mùa cụ thể ("tv:id:N").
 * Cùng quy tắc chắc chắn như khi gộp lúc đồng bộ: bộ đó chỉ có đúng một bản có mùa, hoặc đúng một bản cùng năm.
 */
export async function findSeasonDuplicates(): Promise<DuplicatePair[]> {
  const unknown = await db.movie.findMany({
    where: { tmdbKey: { startsWith: "tv:", endsWith: ":0" } },
    select: { id: true, slug: true, tmdbKey: true, year: true },
  });
  const pairs: DuplicatePair[] = [];
  for (const movie of unknown) {
    const showPrefix = movie.tmdbKey!.replace(/0$/, "");
    const others = await db.movie.findMany({
      where: { tmdbKey: { startsWith: showPrefix }, id: { not: movie.id } },
      select: { id: true, slug: true, year: true },
    });
    const sameYear = others.filter((o) => movie.year !== null && o.year === movie.year);
    const keep = others.length === 1 ? others[0] : sameYear.length === 1 ? sameYear[0] : null;
    if (keep) pairs.push({ keepId: keep.id, keepSlug: keep.slug, dropId: movie.id, dropSlug: movie.slug, tmdbKey: movie.tmdbKey! });
  }
  return pairs;
}

/**
 * Gộp phim `dropId` vào `keepId`: chuyển nguồn, tập, link, lượt xem, yêu thích, lịch sử, báo lỗi rồi xóa bản trùng.
 * Toàn bộ bằng SQL theo lô trong một transaction (DB ở xa, tránh lặp từng tập).
 */
export async function mergeMovies(keepId: number, dropId: number) {
  await db.$transaction([
    // Link của tập đã có ở phim giữ lại: chuyển sang tập đó (bỏ qua nếu trùng nguồn + server)
    db.$executeRaw`
      UPDATE "EpisodeLink" l SET "episodeId" = ke.id
      FROM "Episode" de JOIN "Episode" ke ON ke."movieId" = ${keepId} AND ke.key = de.key
      WHERE l."episodeId" = de.id AND de."movieId" = ${dropId}
        AND NOT EXISTS (
          SELECT 1 FROM "EpisodeLink" x
          WHERE x."episodeId" = ke.id AND x."sourceId" = l."sourceId" AND x."serverName" = l."serverName"
        )`,
    // Tập phim giữ lại chưa có: chuyển nguyên tập (kèm link)
    db.$executeRaw`
      UPDATE "Episode" de SET "movieId" = ${keepId}
      WHERE de."movieId" = ${dropId}
        AND NOT EXISTS (SELECT 1 FROM "Episode" ke WHERE ke."movieId" = ${keepId} AND ke.key = de.key)`,
    db.$executeRaw`UPDATE "MovieSource" SET "movieId" = ${keepId} WHERE "movieId" = ${dropId}`,
    db.$executeRaw`
      INSERT INTO "Favorite" ("userId", "movieId", "createdAt")
      SELECT "userId", ${keepId}, "createdAt" FROM "Favorite" WHERE "movieId" = ${dropId}
      ON CONFLICT DO NOTHING`,
    db.$executeRaw`
      INSERT INTO "WatchHistory" ("userId", "movieId", "episodeKey", "updatedAt")
      SELECT "userId", ${keepId}, "episodeKey", "updatedAt" FROM "WatchHistory" WHERE "movieId" = ${dropId}
      ON CONFLICT ("userId", "movieId") DO UPDATE
        SET "episodeKey" = EXCLUDED."episodeKey", "updatedAt" = EXCLUDED."updatedAt"
        WHERE EXCLUDED."updatedAt" > "WatchHistory"."updatedAt"`,
    db.$executeRaw`UPDATE "Report" SET "movieId" = ${keepId} WHERE "movieId" = ${dropId}`,
    db.$executeRaw`
      UPDATE "Movie" k SET "viewCount" = k."viewCount" + d."viewCount",
        "sourceModifiedAt" = GREATEST(k."sourceModifiedAt", d."sourceModifiedAt")
      FROM "Movie" d WHERE k.id = ${keepId} AND d.id = ${dropId}`,
    // Phần còn lại của bản trùng (tập / link trùng lặp) bị xóa theo cascade
    db.$executeRaw`DELETE FROM "Movie" WHERE id = ${dropId}`,
  ]);
}
