import type { MovieType } from "@/generated/prisma/enums";
import { SourceClient } from "../http";
import {
  absoluteUrl, buildEpisodes, inferStatus, normalizeGenres, parseTmdb, stripHtml, tmdbKey, toDate, toInt, toNameList,
} from "../normalize";
import type { NormalizedMovie, SourceAdapter, SourceListPage, SourceSearchHit, Taxon, TmdbRef } from "../types";
import { kkDetailSchema, kkListSchema, kkSearchSchema, kkTaxonomySchema } from "./schema";

/** Ảnh trong một số endpoint là đường dẫn tương đối, ghép với CDN này. */
export const KK_IMAGE_CDN = "https://phimimg.com";

/**
 * KKPhim trả giờ Việt Nam nhưng gắn nhầm hậu tố "Z" (UTC) — ví dụ phim vừa cập nhật lúc 11:23 trưa
 * lại ghi "11:23Z", tức thời điểm ở tương lai. Đọc lại theo +07:00 để so sánh đúng với nguồn khác.
 */
export function kkTime(value: string | null | undefined): Date | null {
  return toDate(value?.replace(/Z$/, "+07:00"));
}

const TYPE_MAP: Record<string, MovieType> = {
  single: "SINGLE",
  series: "SERIES",
  hoathinh: "ANIMATION",
  tvshows: "TVSHOW",
};

export function parseKkList(json: unknown): SourceListPage {
  const data = kkListSchema.parse(json);
  return {
    totalPages: data.pagination.totalPages,
    items: data.items.map((item) => ({ slug: item.slug, modifiedAt: kkTime(item.modified?.time) })),
  };
}

export function parseKkDetail(json: unknown): NormalizedMovie | null {
  const parsed = kkDetailSchema.safeParse(json);
  if (!parsed.success) return null;
  const { movie, episodes } = parsed.data;

  const episodeList = buildEpisodes(
    (episodes ?? []).map((server) => ({
      serverName: server.is_ai ? `${server.server_name} (AI)` : server.server_name,
      items: server.server_data.map((ep) => ({
        name: ep.name,
        slug: ep.slug ?? undefined,
        embedUrl: ep.link_embed,
        streamUrl: ep.link_m3u8,
      })),
    })),
  );
  const episodeTotal = toInt(movie.episode_total);
  const type = TYPE_MAP[movie.type ?? ""] ?? (episodeList.length > 1 ? "SERIES" : "SINGLE");

  return {
    externalSlug: movie.slug,
    externalId: movie._id ?? null,
    name: movie.name.trim(),
    originName: movie.origin_name?.trim() ?? "",
    altNames: (movie.alternative_names ?? []).map((n) => n.trim()).filter((n) => n && n !== movie.name),
    description: stripHtml(movie.content),
    posterUrl: absoluteUrl(movie.poster_url, KK_IMAGE_CDN),
    thumbUrl: absoluteUrl(movie.thumb_url, KK_IMAGE_CDN),
    type,
    status: inferStatus(movie.status, movie.episode_current ?? null, episodeTotal),
    year: toInt(movie.year),
    duration: movie.time?.trim() || null,
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
    modifiedAt: kkTime(movie.modified?.time),
    episodes: episodeList,
  };
}

export function parseKkSearch(json: unknown): SourceSearchHit[] {
  const parsed = kkSearchSchema.safeParse(json);
  if (!parsed.success) return [];
  return parsed.data.data.items.map((item) => ({
    slug: item.slug,
    originName: item.origin_name?.trim() ?? "",
    year: toInt(item.year),
    tmdb: parseTmdb(item.tmdb),
  }));
}

export class KKPhimAdapter implements SourceAdapter {
  readonly key = "kkphim" as const;
  private readonly http: SourceClient;

  constructor(baseUrls: string[]) {
    this.http = new SourceClient(this.key, baseUrls, 500); // ~2 request/giây
  }

  async listUpdated(page: number) {
    return parseKkList(await this.http.getJson(`/danh-sach/phim-moi-cap-nhat-v3?page=${page}`));
  }

  async getDetail(slug: string) {
    const json = await this.http.getJson(`/phim/${encodeURIComponent(slug)}`);
    return json ? parseKkDetail(json) : null;
  }

  /** KKPhim tra được trực tiếp theo TMDB; với phim bộ chỉ nhận khi đúng season. */
  async findByTmdb(ref: TmdbRef) {
    const json = await this.http.getJson(`/tmdb/${ref.type}/${ref.id}`);
    const movie = json ? parseKkDetail(json) : null;
    return movie && tmdbKey(movie.tmdb) === tmdbKey(ref) ? movie : null;
  }

  async search(keyword: string) {
    return parseKkSearch(await this.http.getJson(`/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&limit=10`));
  }

  async listTaxonomies(): Promise<{ genres: Taxon[]; countries: Taxon[] }> {
    const genres = await this.http.getJson("/the-loai");
    const countries = await this.http.getJson("/quoc-gia");
    const pick = (json: unknown) => kkTaxonomySchema.parse(json).data.items.map(({ slug, name }) => ({ slug, name }));
    return { genres: normalizeGenres(pick(genres)), countries: pick(countries) };
  }
}
