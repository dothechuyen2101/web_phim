import type { MovieType } from "@/generated/prisma/enums";
import { SourceClient } from "../http";
import {
  absoluteUrl, buildEpisodes, inferStatus, normalizeGenres, parseTmdb, stripHtml, toDate, toInt, toNameList,
} from "../normalize";
import type { NormalizedMovie, SourceAdapter, SourceListPage, SourceSearchHit } from "../types";
import { vsDetailSchema, vsListSchema, vsSearchSchema } from "./schema";

/**
 * VSMov (https://vsmov.com/api) — API cùng dạng KKPhim/OPhim. Khác biệt:
 * - thời gian có múi giờ đúng (+07:00), không cần sửa như KKPhim
 * - phim hoạt hình được ghi type "series" kèm thể loại "Hoạt Hình"
 * - chỉ có link nhúng (player cho phép nhúng ở mọi domain: frame-ancestors *), không có link m3u8
 * - phim bộ thường không ghi số mùa TMDB (season null)
 */
const VS_IMAGE_CDN = "https://vsmov.com/storage/images";

const TYPE_MAP: Record<string, MovieType> = {
  single: "SINGLE",
  series: "SERIES",
  hoathinh: "ANIMATION",
  tvshows: "TVSHOW",
};

export function parseVsList(json: unknown): SourceListPage {
  const data = vsListSchema.parse(json);
  return {
    totalPages: data.pagination.totalPages,
    items: data.items.map((item) => ({ slug: item.slug, modifiedAt: toDate(item.modified?.time) })),
  };
}

export function parseVsSearch(json: unknown): SourceSearchHit[] {
  const parsed = vsSearchSchema.safeParse(json);
  if (!parsed.success) return [];
  return parsed.data.items.map((item) => ({
    slug: item.slug,
    originName: item.origin_name?.trim() ?? "",
    year: toInt(item.year),
    tmdb: parseTmdb(item.tmdb),
  }));
}

export function parseVsDetail(json: unknown): NormalizedMovie | null {
  const parsed = vsDetailSchema.safeParse(json);
  if (!parsed.success) return null;
  const { movie, episodes } = parsed.data;

  const episodeList = buildEpisodes(
    (episodes ?? []).map((server) => ({
      serverName: server.server_name,
      items: server.server_data.map((ep) => ({ name: ep.name, slug: ep.slug ?? undefined, embedUrl: ep.link_embed })),
    })),
  );
  const isAnimation = (movie.category ?? []).some((c) => c.slug === "hoat-hinh");
  const type: MovieType = isAnimation
    ? "ANIMATION"
    : (TYPE_MAP[movie.type ?? ""] ?? (episodeList.length > 1 ? "SERIES" : "SINGLE"));
  const episodeTotal = toInt(movie.episode_total);
  const minutes = toInt(movie.time);

  return {
    externalSlug: movie.slug,
    externalId: movie._id != null ? String(movie._id) : null,
    name: movie.name.trim(),
    originName: movie.origin_name?.trim() ?? "",
    altNames: [],
    description: stripHtml(movie.content),
    posterUrl: absoluteUrl(movie.poster_url, VS_IMAGE_CDN),
    thumbUrl: absoluteUrl(movie.thumb_url, VS_IMAGE_CDN),
    type,
    status: inferStatus(movie.status, movie.episode_current ?? null, episodeTotal),
    year: toInt(movie.year),
    duration: minutes ? `${minutes} phút${type === "SINGLE" ? "" : "/tập"}` : null,
    episodeCurrent: movie.episode_current?.trim() || null,
    episodeTotal,
    quality: movie.quality?.trim() || null,
    lang: movie.lang?.trim() || null,
    actors: toNameList(movie.actor),
    directors: toNameList(movie.director),
    tmdb: parseTmdb(movie.tmdb),
    imdbId: movie.imdb?.id?.trim() || null,
    genres: normalizeGenres(movie.category ?? []),
    countries: (movie.country ?? []).map(({ slug, name }) => ({ slug, name })),
    modifiedAt: toDate(movie.modified?.time),
    episodes: episodeList,
  };
}

export class VSMovAdapter implements SourceAdapter {
  readonly key = "vsmov" as const;
  private readonly http: SourceClient;

  constructor(baseUrls: string[]) {
    this.http = new SourceClient(this.key, baseUrls, 1000); // ~1 request/giây, chưa rõ giới hạn của nguồn
  }

  async listUpdated(page: number) {
    return parseVsList(await this.http.getJson(`/danh-sach/phim-moi-cap-nhat?page=${page}`));
  }

  async getDetail(slug: string) {
    const json = await this.http.getJson(`/phim/${encodeURIComponent(slug)}`);
    return json ? parseVsDetail(json) : null;
  }

  async search(keyword: string) {
    return parseVsSearch(await this.http.getJson(`/tim-kiem?keyword=${encodeURIComponent(keyword)}`));
  }
}
