import { Prisma } from "@/generated/prisma/client";
import type { MovieType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { ADULT_GENRE_SLUGS, matchKey, tmdbKey, toSearchText } from "@/sources/normalize";
import type { NormalizedEpisode, NormalizedMovie, Taxon } from "@/sources/types";

export interface IngestSource {
  id: number;
  priority: number;
}

export interface UpsertResult {
  movieId: number;
  slug: string;
  created: boolean;
}

const movieWithSources = {
  sources: { select: { sourceId: true, source: { select: { priority: true } } } },
  _count: { select: { genres: true, countries: true } },
} satisfies Prisma.MovieInclude;

type ExistingMovie = Prisma.MovieGetPayload<{ include: typeof movieWithSources }>;

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/**
 * Ghi một phim của một nguồn vào DB, gộp với phim đã có nếu trùng.
 * Thứ tự khớp: liên kết nguồn đã lưu → TMDB (type,id,season) → IMDb (chỉ phim lẻ) → tên gốc + năm + loại.
 * Trả null nếu phim bị bỏ qua (thể loại người lớn).
 */
export async function upsertMovie(
  source: IngestSource,
  movie: NormalizedMovie,
  lastModified: Date | null = movie.modifiedAt,
  /** Gắn thẳng vào phim này (dùng khi "tìm nguồn thay thế" đã tự xác minh là cùng phim). */
  targetMovieId?: number,
): Promise<UpsertResult | null> {
  if (movie.genres.some((genre) => ADULT_GENRE_SLUGS.has(genre.slug))) return null;
  try {
    return await upsertOnce(source, movie, lastModified, targetMovieId);
  } catch (error) {
    // Hai lần ghi chạy song song cùng tạo một phim: lần thử lại sẽ khớp vào phim vừa tạo
    if (isUniqueViolation(error)) return upsertOnce(source, movie, lastModified, targetMovieId);
    throw error;
  }
}

/**
 * Phim bộ: có nguồn không ghi số mùa TMDB (khóa "tv:id:0"), nguồn khác ghi rõ ("tv:id:1").
 * Khớp chéo hai trường hợp đó khi chắc chắn: chỉ có một phim của bộ đó ở phía bên kia,
 * hoặc nhiều mùa nhưng đúng một mùa cùng năm. Không chắc thì để tạo phim riêng (không gộp nhầm mùa).
 */
async function findAcrossUnknownSeason(movie: NormalizedMovie): Promise<ExistingMovie | null> {
  if (movie.tmdb?.type !== "tv") return null;
  const unknownSeason = movie.tmdb.season === null;
  const sameShow = await db.movie.findMany({
    where: unknownSeason
      ? { tmdbKey: { startsWith: `tv:${movie.tmdb.id}:` } }
      : { tmdbKey: `tv:${movie.tmdb.id}:0` },
    include: movieWithSources,
    take: 20,
  });
  if (sameShow.length === 1) return sameShow[0];
  const sameYear = sameShow.filter((m) => movie.year !== null && m.year === movie.year);
  return sameYear.length === 1 ? sameYear[0] : null;
}

async function findExisting(sourceId: number, movie: NormalizedMovie, targetMovieId?: number): Promise<ExistingMovie | null> {
  const link = await db.movieSource.findUnique({
    where: { sourceId_externalSlug: { sourceId, externalSlug: movie.externalSlug } },
    select: { movieId: true },
  });
  if (link) return db.movie.findUnique({ where: { id: link.movieId }, include: movieWithSources });
  if (targetMovieId) return db.movie.findUnique({ where: { id: targetMovieId }, include: movieWithSources });

  const key = tmdbKey(movie.tmdb);
  if (key) {
    const byTmdb = await db.movie.findUnique({ where: { tmdbKey: key }, include: movieWithSources });
    if (byTmdb) return byTmdb;
    const bySeasonGap = await findAcrossUnknownSeason(movie);
    if (bySeasonGap) return bySeasonGap;
  }
  // Các khóa dự phòng không được khớp vào phim đã gắn một TMDB khác
  const tmdbCompatible: Prisma.MovieWhereInput = key ? { OR: [{ tmdbKey: null }, { tmdbKey: key }] } : {};
  if (movie.type === "SINGLE" && movie.imdbId) {
    const byImdb = await db.movie.findFirst({
      where: { imdbId: movie.imdbId, type: "SINGLE", ...tmdbCompatible },
      include: movieWithSources,
    });
    if (byImdb) return byImdb;
  }
  const mKey = matchKey(movie.originName, movie.year, movie.type);
  if (mKey) {
    return db.movie.findFirst({ where: { matchKey: mKey, ...tmdbCompatible }, include: movieWithSources });
  }
  return null;
}

async function uniqueSlug(base: string, year: number | null): Promise<string> {
  const root = base || "phim";
  const candidates = [root, ...(year ? [`${root}-${year}`] : [])];
  for (let i = 2; candidates.length < 20; i++) candidates.push(`${root}-${i}`);
  const taken = new Set(
    (await db.movie.findMany({ where: { slug: { in: candidates } }, select: { slug: true } })).map((m) => m.slug),
  );
  return candidates.find((slug) => !taken.has(slug)) ?? `${root}-${Date.now()}`;
}

/** Tạo thể loại / quốc gia còn thiếu rồi lấy id — 2 truy vấn cho cả danh sách (DB ở xa nên tránh từng dòng một). */
async function upsertTaxa(kind: "genre" | "country", taxa: Taxon[]): Promise<number[]> {
  if (taxa.length === 0) return [];
  const slugs = taxa.map((t) => t.slug);
  const data = taxa.map(({ slug, name }) => ({ slug, name }));
  if (kind === "genre") {
    await db.genre.createMany({ data, skipDuplicates: true });
    return (await db.genre.findMany({ where: { slug: { in: slugs } }, select: { id: true } })).map((r) => r.id);
  }
  await db.country.createMany({ data, skipDuplicates: true });
  return (await db.country.findMany({ where: { slug: { in: slugs } }, select: { id: true } })).map((r) => r.id);
}

const isEmpty = (value: unknown) =>
  value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

async function upsertOnce(source: IngestSource, movie: NormalizedMovie, lastModified: Date | null, targetMovieId?: number) {
  const existing = await findExisting(source.id, movie, targetMovieId);
  const otherPriorities = (existing?.sources ?? [])
    .filter((s) => s.sourceId !== source.id)
    .map((s) => s.source.priority);
  // Nguồn ưu tiên cao nhất quyết định metadata; nguồn phụ chỉ điền chỗ trống và thêm server
  const isPrimary = !existing || otherPriorities.every((p) => source.priority >= p);

  const meta = {
    name: movie.name,
    originName: movie.originName,
    altNames: movie.altNames,
    description: movie.description,
    posterUrl: movie.posterUrl,
    thumbUrl: movie.thumbUrl,
    type: movie.type,
    status: movie.status,
    year: movie.year,
    duration: movie.duration,
    episodeCurrent: movie.episodeCurrent,
    episodeTotal: movie.episodeTotal,
    quality: movie.quality,
    lang: movie.lang,
    actors: movie.actors,
    directors: movie.directors,
    imdbId: movie.imdbId,
  };
  const key = tmdbKey(movie.tmdb);
  const [genreIds, countryIds] = await Promise.all([
    upsertTaxa("genre", movie.genres),
    upsertTaxa("country", movie.countries),
  ]);

  let movieId: number;
  let slug: string;
  if (!existing) {
    slug = await uniqueSlug(movie.externalSlug, movie.year);
    const created = await db.movie.create({
      data: {
        ...meta,
        slug,
        tmdbKey: key,
        matchKey: matchKey(movie.originName, movie.year, movie.type),
        searchText: toSearchText(movie.name, movie.originName, ...movie.altNames),
        sourceModifiedAt: movie.modifiedAt ?? new Date(),
        genres: { connect: genreIds.map((id) => ({ id })) },
        countries: { connect: countryIds.map((id) => ({ id })) },
      },
      select: { id: true },
    });
    movieId = created.id;
  } else {
    movieId = existing.id;
    slug = existing.slug;
    const data: Prisma.MovieUpdateInput = {};
    for (const [field, value] of Object.entries(meta) as [keyof typeof meta, unknown][]) {
      if (isPrimary ? !isEmpty(value) : isEmpty(existing[field]) && !isEmpty(value)) {
        (data as Record<string, unknown>)[field] = value;
      }
    }
    // Gắn TMDB nếu phim chưa có, hoặc nâng khóa "chưa rõ mùa" (tv:id:0) lên mùa cụ thể khi nguồn này ghi rõ
    const upgradesSeason = !!key && existing.tmdbKey?.endsWith(":0") && existing.tmdbKey !== key
      && existing.tmdbKey.startsWith(`tv:${movie.tmdb?.id}:`);
    if ((!existing.tmdbKey || upgradesSeason) && key && !(await db.movie.findUnique({ where: { tmdbKey: key }, select: { id: true } }))) {
      data.tmdbKey = key;
    }
    if (movie.modifiedAt && (!existing.sourceModifiedAt || movie.modifiedAt > existing.sourceModifiedAt)) {
      data.sourceModifiedAt = movie.modifiedAt;
    }
    if (isPrimary || existing._count.genres === 0) data.genres = { set: genreIds.map((id) => ({ id })) };
    if (isPrimary || existing._count.countries === 0) data.countries = { set: countryIds.map((id) => ({ id })) };

    const name = (data.name as string | undefined) ?? existing.name;
    const originName = (data.originName as string | undefined) ?? existing.originName;
    const altNames = (data.altNames as string[] | undefined) ?? existing.altNames;
    data.searchText = toSearchText(name, originName, ...altNames);
    data.matchKey = matchKey(
      originName,
      (data.year as number | undefined) ?? existing.year,
      (data.type as MovieType | undefined) ?? existing.type,
    );

    await db.movie.update({ where: { id: movieId }, data });
  }

  // Hai việc độc lập: chạy song song để bớt một lượt chờ DB
  await Promise.all([
    db.movieSource.upsert({
      where: { sourceId_externalSlug: { sourceId: source.id, externalSlug: movie.externalSlug } },
      create: { movieId, sourceId: source.id, externalSlug: movie.externalSlug, externalId: movie.externalId, lastModified },
      update: { movieId, externalId: movie.externalId, lastModified },
    }),
    syncEpisodes(movieId, source.id, movie.episodes, isPrimary),
  ]);
  return { movieId, slug, created: !existing };
}

/**
 * Đồng bộ tập + link của một nguồn cho một phim, theo kiểu diff để phim nhiều tập không phải ghi lại toàn bộ.
 * DB có thể ở xa (Supabase): đọc song song, ghi theo lô, bỏ qua truy vấn không cần thiết.
 */
async function syncEpisodes(movieId: number, sourceId: number, episodes: NormalizedEpisode[], isPrimary: boolean) {
  const [existingEpisodes, existingLinks] = await Promise.all([
    db.episode.findMany({ where: { movieId }, select: { id: true, key: true, name: true, sortOrder: true } }),
    db.episodeLink.findMany({
      where: { sourceId, episode: { movieId } },
      select: { id: true, episodeId: true, serverName: true, embedUrl: true, streamUrl: true },
    }),
  ]);
  // Nguồn tạm trả danh sách tập rỗng: giữ link cũ thay vì xóa sạch
  if (episodes.length === 0 && existingLinks.length > 0) return;
  const episodeByKey = new Map(existingEpisodes.map((e) => [e.key, e]));

  const missing = episodes.filter((e) => !episodeByKey.has(e.key));
  if (missing.length > 0) {
    await db.episode.createMany({
      data: missing.map((e) => ({ movieId, key: e.key, name: e.name, sortOrder: e.sortOrder })),
      skipDuplicates: true,
    });
    for (const row of await db.episode.findMany({
      where: { movieId, key: { in: missing.map((e) => e.key) } },
      select: { id: true, key: true, name: true, sortOrder: true },
    })) {
      episodeByKey.set(row.key, row);
    }
  }
  const writes: Promise<unknown>[] = [];
  if (isPrimary) {
    for (const episode of episodes) {
      const row = episodeByKey.get(episode.key);
      if (row && (row.name !== episode.name || row.sortOrder !== episode.sortOrder)) {
        writes.push(db.episode.update({ where: { id: row.id }, data: { name: episode.name, sortOrder: episode.sortOrder } }));
      }
    }
  }

  const linkByKey = new Map(existingLinks.map((l) => [`${l.episodeId}|${l.serverName}`, l]));
  const kept = new Set<number>();
  const toCreate: Prisma.EpisodeLinkCreateManyInput[] = [];
  for (const episode of episodes) {
    const episodeId = episodeByKey.get(episode.key)?.id;
    if (!episodeId) continue;
    for (const link of episode.links) {
      const current = linkByKey.get(`${episodeId}|${link.serverName}`);
      const streamUrl = link.streamUrl ?? null;
      if (!current) {
        toCreate.push({ episodeId, sourceId, serverName: link.serverName, embedUrl: link.embedUrl, streamUrl });
        continue;
      }
      kept.add(current.id);
      if (current.embedUrl !== link.embedUrl) {
        // Nguồn đã thay link mới: coi như link mới hoàn toàn, bỏ trạng thái hỏng cũ
        writes.push(
          db.episodeLink.update({
            where: { id: current.id },
            data: { embedUrl: link.embedUrl, streamUrl, broken: false, failCount: 0, checkedAt: null },
          }),
        );
      } else if (current.streamUrl !== streamUrl) {
        writes.push(db.episodeLink.update({ where: { id: current.id }, data: { streamUrl } }));
      }
    }
  }
  if (toCreate.length > 0) writes.push(db.episodeLink.createMany({ data: toCreate, skipDuplicates: true }));
  const stale = existingLinks.filter((l) => !kept.has(l.id)).map((l) => l.id);
  if (stale.length > 0) writes.push(db.episodeLink.deleteMany({ where: { id: { in: stale } } }));
  await Promise.all(writes);
  // Chỉ dọn tập không còn link khi vừa xóa link (phần lớn lượt đồng bộ không xóa gì)
  if (stale.length > 0) await db.episode.deleteMany({ where: { movieId, links: { none: {} } } });
}
