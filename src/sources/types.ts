import type { MovieStatus, MovieType } from "@/generated/prisma/enums";

export type SourceKey = "kkphim" | "nguonc" | "vsmov";

export interface Taxon {
  slug: string;
  name: string;
}

/** Một phim trong danh sách "mới cập nhật" — chỉ đủ để quyết định có cần lấy chi tiết hay không. */
export interface SourceListItem {
  slug: string;
  modifiedAt: Date | null;
}

export interface SourceListPage {
  items: SourceListItem[];
  totalPages: number;
}

export interface NormalizedLink {
  serverName: string;
  embedUrl: string;
  /** link luồng gốc (m3u8) nếu nguồn cho — để kiểm tra link sống/chết */
  streamUrl?: string | null;
}

/** Kết quả tìm kiếm ở một nguồn, đủ để ghép với phim đã có (theo TMDB hoặc tên gốc + năm). */
export interface SourceSearchHit {
  slug: string;
  originName: string;
  year: number | null;
  tmdb: TmdbRef | null;
}

export interface NormalizedEpisode {
  key: string;
  name: string;
  sortOrder: number;
  links: NormalizedLink[];
}

export interface TmdbRef {
  type: "movie" | "tv";
  id: number;
  season: number | null;
}

/** Phim đã chuẩn hóa về một dạng chung, độc lập với nguồn. */
export interface NormalizedMovie {
  externalSlug: string;
  externalId: string | null;
  name: string;
  originName: string;
  altNames: string[];
  description: string;
  posterUrl: string | null;
  thumbUrl: string | null;
  type: MovieType;
  status: MovieStatus;
  year: number | null;
  duration: string | null;
  episodeCurrent: string | null;
  episodeTotal: number | null;
  quality: string | null;
  lang: string | null;
  actors: string[];
  directors: string[];
  tmdb: TmdbRef | null;
  imdbId: string | null;
  genres: Taxon[];
  countries: Taxon[];
  modifiedAt: Date | null;
  episodes: NormalizedEpisode[];
}

export interface SourceAdapter {
  key: SourceKey;
  listUpdated(page: number): Promise<SourceListPage>;
  getDetail(slug: string): Promise<NormalizedMovie | null>;
  listTaxonomies?(): Promise<{ genres: Taxon[]; countries: Taxon[] }>;
  /** Tra phim theo TMDB (dùng khi tìm nguồn thay thế cho phim có link chết). */
  findByTmdb?(ref: TmdbRef): Promise<NormalizedMovie | null>;
  /** Tìm theo tên (dùng khi tìm nguồn thay thế cho phim chưa có TMDB, hoặc nguồn không tra được TMDB). */
  search?(keyword: string): Promise<SourceSearchHit[]>;
}
