import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import type { MovieStatus, MovieType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { PAGE_SIZE, type SortKey } from "@/lib/site";
import { toSearchText } from "@/sources/normalize";

/** Tag cho mọi danh sách phim (trang chủ, danh sách, tìm kiếm). Worker làm mới sau mỗi lần đồng bộ. */
export const MOVIES_TAG = "movies";
export const movieTag = (slug: string) => `movie:${slug}`;
/** Gắn cho mọi trang chi tiết/xem phim: dùng khi thay đổi ảnh hưởng toàn bộ (bật/tắt nguồn). */
export const MOVIE_DETAIL_TAG = "movie-detail";

const cardSelect = {
  id: true,
  slug: true,
  name: true,
  originName: true,
  posterUrl: true,
  thumbUrl: true,
  year: true,
  episodeCurrent: true,
  quality: true,
  lang: true,
  type: true,
} satisfies Prisma.MovieSelect;

export type MovieCardData = Prisma.MovieGetPayload<{ select: typeof cardSelect }>;

export interface MovieFilters {
  type?: MovieType;
  anime?: boolean;
  genre?: string;
  country?: string;
  year?: number;
  status?: MovieStatus;
  sort?: SortKey;
}

export interface MoviePage {
  items: MovieCardData[];
  total: number;
  page: number;
  totalPages: number;
}

function filterWhere(filters: MovieFilters): Prisma.MovieWhereInput {
  const and: Prisma.MovieWhereInput[] = [{ hidden: false }];
  if (filters.type) and.push({ type: filters.type });
  if (filters.anime) and.push({ countries: { some: { slug: "nhat-ban" } } });
  if (filters.genre) and.push({ genres: { some: { slug: filters.genre } } });
  if (filters.country) and.push({ countries: { some: { slug: filters.country } } });
  if (filters.year) and.push({ year: filters.year });
  if (filters.status) and.push({ status: filters.status });
  return { AND: and };
}

function sortOrder(sort: SortKey | undefined): Prisma.MovieOrderByWithRelationInput[] {
  switch (sort) {
    case "xem-nhieu":
      return [{ viewCount: "desc" }, { id: "desc" }];
    case "nam":
      return [{ year: { sort: "desc", nulls: "last" } }, { sourceModifiedAt: "desc" }];
    case "ten":
      return [{ name: "asc" }];
    default:
      return [{ sourceModifiedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }];
  }
}

export async function listMovies(filters: MovieFilters, page = 1): Promise<MoviePage> {
  "use cache";
  cacheLife("catalog");
  cacheTag(MOVIES_TAG);

  const where = filterWhere(filters);
  const [total, items] = await Promise.all([
    db.movie.count({ where }),
    db.movie.findMany({
      where,
      orderBy: sortOrder(filters.sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: cardSelect,
    }),
  ]);
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getHomeData() {
  "use cache";
  cacheLife("catalog");
  cacheTag(MOVIES_TAG);

  const latest = (where: Prisma.MovieWhereInput, take = 12) =>
    db.movie.findMany({
      where: { hidden: false, ...where },
      orderBy: [{ sourceModifiedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
      take,
      select: cardSelect,
    });
  const [featuredRows, series, singles, animation, anime, popular] = await Promise.all([
    db.movie.findMany({
      where: { hidden: false, thumbUrl: { not: null }, episodes: { some: {} } },
      orderBy: [{ sourceModifiedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
      take: 6,
      select: { ...cardSelect, description: true, genres: { select: { name: true }, take: 3 } },
    }),
    latest({ type: "SERIES" }),
    latest({ type: "SINGLE" }),
    latest({ type: "ANIMATION", NOT: { countries: { some: { slug: "nhat-ban" } } } }),
    latest({ type: "ANIMATION", countries: { some: { slug: "nhat-ban" } } }),
    db.movie.findMany({ where: { hidden: false }, orderBy: [{ viewCount: "desc" }, { id: "desc" }], take: 12, select: cardSelect }),
  ]);
  const featured = featuredRows.map(({ description, genres, ...movie }) => ({
    ...movie,
    description: description.length > 260 ? `${description.slice(0, 259).trimEnd()}…` : description,
    genres: genres.map((g) => g.name),
  }));
  return { featured, series, singles, animation, anime, popular };
}

export async function getFilterOptions() {
  "use cache";
  cacheLife("catalog");
  cacheTag(MOVIES_TAG);

  const [genres, countries, years] = await Promise.all([
    db.genre.findMany({ where: { slug: { not: "phim-18" } }, orderBy: { name: "asc" }, select: { slug: true, name: true } }),
    db.country.findMany({ where: { movies: { some: {} } }, orderBy: { name: "asc" }, select: { slug: true, name: true } }),
    db.movie.findMany({
      where: { hidden: false, year: { not: null } },
      distinct: ["year"],
      orderBy: { year: "desc" },
      select: { year: true },
    }),
  ]);
  return { genres, countries, years: years.map((y) => y.year!).filter((y) => y > 1900) };
}

export async function getMovie(slug: string) {
  "use cache";
  cacheLife("catalog");
  cacheTag(movieTag(slug), MOVIE_DETAIL_TAG);

  return db.movie.findFirst({
    where: { slug, hidden: false },
    include: {
      genres: { select: { slug: true, name: true } },
      countries: { select: { slug: true, name: true } },
      episodes: {
        orderBy: { sortOrder: "asc" },
        select: {
          key: true,
          name: true,
          links: {
            // Tắt nguồn trong admin là ẩn ngay server của nguồn đó
            where: { broken: false, source: { enabled: true } },
            orderBy: [{ source: { priority: "desc" } }, { serverName: "asc" }],
            select: { id: true, serverName: true, embedUrl: true, streamUrl: true, source: { select: { name: true } } },
          },
        },
      },
    },
  });
}

export type MovieDetail = NonNullable<Awaited<ReturnType<typeof getMovie>>>;

export async function getRelated(movieId: number, type: MovieType, genreSlugs: string[]) {
  "use cache";
  cacheLife("catalog");
  cacheTag(MOVIES_TAG);

  return db.movie.findMany({
    where: {
      hidden: false,
      id: { not: movieId },
      type,
      ...(genreSlugs.length > 0 ? { genres: { some: { slug: { in: genreSlugs } } } } : {}),
    },
    orderBy: [{ viewCount: "desc" }, { sourceModifiedAt: "desc" }],
    take: 12,
    select: cardSelect,
  });
}

/** Tìm không dấu: mọi từ khóa phải xuất hiện trong searchText, xếp theo độ giống (pg_trgm). */
export async function searchMovies(query: string, page = 1, pageSize = PAGE_SIZE): Promise<MoviePage> {
  "use cache";
  cacheLife("catalog");
  cacheTag(MOVIES_TAG);

  const normalized = toSearchText(query).slice(0, 100);
  const tokens = normalized.split(" ").filter(Boolean).slice(0, 8);
  if (tokens.length === 0) return { items: [], total: 0, page, totalPages: 1 };
  // token chỉ gồm [a-z0-9] sau toSearchText nên không cần escape ký tự đặc biệt của LIKE
  const patterns = tokens.map((t) => `%${t}%`);

  const [rows, [{ count }]] = await Promise.all([
    db.$queryRaw<{ id: number }[]>`
      SELECT id FROM "Movie"
      WHERE hidden = false AND "searchText" LIKE ALL(${patterns}::text[])
      ORDER BY similarity("searchText", ${normalized}) DESC, "viewCount" DESC, id DESC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    db.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM "Movie"
      WHERE hidden = false AND "searchText" LIKE ALL(${patterns}::text[])`,
  ]);
  const ids = rows.map((r) => r.id);
  const movies = await db.movie.findMany({ where: { id: { in: ids } }, select: cardSelect });
  const byId = new Map(movies.map((m) => [m.id, m]));
  const total = Number(count);
  return {
    items: ids.map((id) => byId.get(id)).filter((m): m is MovieCardData => !!m),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
