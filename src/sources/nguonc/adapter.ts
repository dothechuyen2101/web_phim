import type { MovieType } from "@/generated/prisma/enums";
import { SourceClient } from "../http";
import {
  absoluteUrl, buildEpisodes, inferStatus, normalizeGenres, parseTmdb, removeDiacritics, slugify, stripHtml,
  toDate, toInt, toNameList,
} from "../normalize";
import type { NormalizedMovie, SourceAdapter, SourceListPage, SourceSearchHit } from "../types";
import { ncDetailSchema, ncListSchema, ncSearchSchema } from "./schema";

const NC_IMAGE_CDN = "https://img.nguonc.com";

const FORMAT_MAP: Record<string, MovieType> = {
  "phim-le": "SINGLE",
  "phim-bo": "SERIES",
  "tv-shows": "TVSHOW",
};

/** Quốc gia NguonC đặt tên khác KKPhim. */
const COUNTRY_ALIASES: Record<string, { slug: string; name: string }> = {
  my: { slug: "au-my", name: "Âu Mỹ" },
  "hoa-ky": { slug: "au-my", name: "Âu Mỹ" },
};

export function parseNcList(json: unknown): SourceListPage {
  const data = ncListSchema.parse(json);
  return {
    totalPages: data.paginate.total_page,
    items: data.items.map((item) => ({ slug: item.slug, modifiedAt: toDate(item.modified) })),
  };
}

export function parseNcDetail(json: unknown): NormalizedMovie | null {
  const parsed = ncDetailSchema.safeParse(json);
  if (!parsed.success) return null;
  const { movie } = parsed.data;

  // category gom "Định dạng", "Thể loại", "Năm", "Quốc gia" vào một object
  const groups = new Map<string, string[]>();
  for (const group of Object.values(movie.category ?? {})) {
    const groupName = removeDiacritics(group.group.name).toLowerCase().trim();
    groups.set(groupName, group.list.map((item) => item.name.trim()));
  }
  const genreNames = groups.get("the loai") ?? [];
  const isAnimation = genreNames.some((name) => slugify(name) === "hoat-hinh");
  const format = (groups.get("dinh dang") ?? []).map(slugify).find((slug) => FORMAT_MAP[slug]);

  const episodes = buildEpisodes(
    (movie.episodes ?? []).map((server) => ({
      serverName: server.server_name,
      items: server.items.map((ep) => ({ name: ep.name, slug: ep.slug ?? undefined, embedUrl: ep.embed })),
    })),
  );
  const type: MovieType = isAnimation
    ? "ANIMATION"
    : format
      ? FORMAT_MAP[format]
      : episodes.length > 1
        ? "SERIES"
        : "SINGLE";
  const episodeTotal = toInt(movie.total_episodes);
  const countries = new Map<string, string>();
  for (const name of groups.get("quoc gia") ?? []) {
    const alias = COUNTRY_ALIASES[slugify(name)];
    countries.set(alias?.slug ?? slugify(name), alias?.name ?? name);
  }

  return {
    externalSlug: movie.slug,
    externalId: movie.id ?? null,
    name: movie.name.trim(),
    originName: movie.original_name?.trim() ?? "",
    altNames: [],
    description: stripHtml(movie.description),
    posterUrl: absoluteUrl(movie.poster_url_webp || movie.poster_url, NC_IMAGE_CDN),
    thumbUrl: absoluteUrl(movie.thumb_url_webp || movie.thumb_url, NC_IMAGE_CDN),
    type,
    status: inferStatus(null, movie.current_episode ?? null, episodeTotal),
    year: toInt(movie.year) ?? toInt(groups.get("nam")?.[0]),
    duration: movie.time?.trim() || null,
    episodeCurrent: movie.current_episode?.trim() || null,
    episodeTotal,
    quality: movie.quality?.trim() || null,
    lang: movie.language?.trim() || null,
    actors: toNameList(movie.casts),
    directors: toNameList(movie.director),
    tmdb: parseTmdb(movie.tmdb),
    imdbId: movie.imdb?.id?.trim() || null,
    genres: normalizeGenres(genreNames.map((name) => ({ name }))),
    countries: [...countries].map(([slug, name]) => ({ slug, name })).filter((c) => c.slug),
    modifiedAt: toDate(movie.modified),
    episodes,
  };
}

export function parseNcSearch(json: unknown): SourceSearchHit[] {
  const parsed = ncSearchSchema.safeParse(json);
  if (!parsed.success) return [];
  return parsed.data.items.map((item) => ({
    slug: item.slug,
    originName: item.original_name?.trim() ?? "",
    year: toInt(item.year),
    tmdb: parseTmdb(item.tmdb),
  }));
}

export class NguonCAdapter implements SourceAdapter {
  readonly key = "nguonc" as const;
  private readonly http: SourceClient;

  constructor(baseUrls: string[]) {
    this.http = new SourceClient(this.key, baseUrls, 1000); // ~1 request/giây, nguồn có giới hạn 429
  }

  async listUpdated(page: number) {
    return parseNcList(await this.http.getJson(`/films/phim-moi-cap-nhat?page=${page}`));
  }

  async getDetail(slug: string) {
    const json = await this.http.getJson(`/film/${encodeURIComponent(slug)}`);
    return json ? parseNcDetail(json) : null;
  }

  async search(keyword: string) {
    return parseNcSearch(await this.http.getJson(`/films/search?keyword=${encodeURIComponent(keyword)}`));
  }
}
