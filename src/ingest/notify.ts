import { db } from "@/lib/db";
import { pushConfig, sendPush, type PushPayload } from "@/lib/push";
import { NEW_EPISODE_GRACE_MINUTES, SITE_NAME, watchUrl } from "@/lib/site";

/**
 * Báo tập mới qua Web Push cho người đã "Yêu thích" phim và đã bật thông báo.
 * Mỗi lượt xử lý các tập được thêm sau mốc của lượt trước (lưu trong CronState).
 */
const MARKER = "notify-episodes";
/** Quá chừng này phim có tập mới cùng lúc thì gộp thành một thông báo, tránh làm phiền. */
const MAX_PER_USER = 3;
const SEND_CONCURRENCY = 8;

export interface NewEpisodeRow {
  userId: number;
  movieId: number;
  slug: string;
  movieName: string;
  posterUrl: string | null;
  episodeKey: string;
  episodeName: string;
  sortOrder: number;
}

/** Gom tập mới thành thông báo cho từng người: mỗi phim một thông báo (kèm tập mới nhất); nhiều phim thì gộp lại. */
export function buildNotifications(rows: NewEpisodeRow[]): Map<number, PushPayload[]> {
  const byUser = new Map<number, Map<number, { latest: NewEpisodeRow; count: number }>>();
  for (const row of rows) {
    let movies = byUser.get(row.userId);
    if (!movies) byUser.set(row.userId, (movies = new Map()));
    const entry = movies.get(row.movieId);
    if (!entry) movies.set(row.movieId, { latest: row, count: 1 });
    else {
      entry.count++;
      if (row.sortOrder > entry.latest.sortOrder) entry.latest = row;
    }
  }

  const result = new Map<number, PushPayload[]>();
  for (const [userId, movies] of byUser) {
    const items = [...movies.values()];
    if (items.length > MAX_PER_USER) {
      const names = items.slice(0, MAX_PER_USER).map((item) => item.latest.movieName).join(", ");
      result.set(userId, [
        { title: SITE_NAME, body: `${items.length} phim bạn yêu thích có tập mới: ${names}…`, url: "/tai-khoan/yeu-thich", tag: "new-episodes" },
      ]);
      continue;
    }
    result.set(
      userId,
      items.map(({ latest, count }) => ({
        title: latest.movieName,
        body: count > 1 ? `Đã có ${count} tập mới, mới nhất: ${latest.episodeName}` : `Đã có ${latest.episodeName}`,
        url: watchUrl(latest.slug, latest.episodeKey),
        tag: `movie-${latest.movieId}`,
        icon: latest.posterUrl,
      })),
    );
  }
  return result;
}

export async function notifyNewEpisodes({ log = console.log }: { log?: (message: string) => void } = {}) {
  if (!pushConfig()) return { sent: 0, skipped: "chưa cấu hình khóa VAPID" };
  const until = new Date();
  const marker = await db.cronState.findUnique({ where: { name: MARKER }, select: { lastRunAt: true } });
  if (!marker?.lastRunAt) {
    // Lần đầu chạy: chỉ đặt mốc, không báo lại các tập đã có từ trước
    await db.cronState.upsert({ where: { name: MARKER }, create: { name: MARKER, lastRunAt: until }, update: { lastRunAt: until } });
    return { sent: 0, skipped: "lần đầu — chỉ đặt mốc" };
  }

  // Chỉ tập thêm sau khi phim đã có trên web (không tính lúc nhập cả bộ) và sau khi người đó bấm yêu thích
  const rows = await db.$queryRaw<NewEpisodeRow[]>`
    SELECT f."userId", m."id" AS "movieId", m."slug", m."name" AS "movieName", m."posterUrl",
           e."key" AS "episodeKey", e."name" AS "episodeName", e."sortOrder"
    FROM "Episode" e
    JOIN "Movie" m ON m."id" = e."movieId" AND m."hidden" = false
    JOIN "Favorite" f ON f."movieId" = m."id" AND f."createdAt" < e."createdAt"
    WHERE e."createdAt" > ${marker.lastRunAt} AND e."createdAt" <= ${until}
      AND e."createdAt" > m."createdAt" + ${NEW_EPISODE_GRACE_MINUTES}::int * interval '1 minute'
      AND EXISTS (SELECT 1 FROM "PushSubscription" p WHERE p."userId" = f."userId")
    LIMIT 20000`;

  const notifications = buildNotifications(rows);
  let sent = 0;
  let failed = 0;
  const gone = new Set<number>();
  if (notifications.size > 0) {
    const targets = await db.pushSubscription.findMany({ where: { userId: { in: [...notifications.keys()] } } });
    const queue = targets.flatMap((target) => (notifications.get(target.userId) ?? []).map((payload) => ({ target, payload })));
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(SEND_CONCURRENCY, queue.length) }, async () => {
        while (next < queue.length) {
          const { target, payload } = queue[next++];
          if (gone.has(target.id)) continue;
          const result = await sendPush(target, payload);
          if (result === "ok") sent++;
          else if (result === "gone") gone.add(target.id);
          else failed++;
        }
      }),
    );
    if (gone.size > 0) await db.pushSubscription.deleteMany({ where: { id: { in: [...gone] } } });
  }
  await db.cronState.update({ where: { name: MARKER }, data: { lastRunAt: until } });
  log(`[notify] ${rows.length} tập mới cho ${notifications.size} người: gửi ${sent}, lỗi ${failed}, thiết bị đã hủy ${gone.size}`);
  return { sent, failed, gone: gone.size };
}
