import type { Metadata } from "next";
import type { MovieStatus, MovieType } from "@/generated/prisma/enums";
import type { MovieFilters } from "@/lib/queries";
import { SORT_OPTIONS, type SortKey } from "@/lib/site";

export type SearchParams = Record<string, string | string[] | undefined>;

/** Tham số lọc trên URL (tiếng Việt) ↔ giá trị trong DB */
export const TYPE_PARAMS: Record<string, { type: MovieType; label: string }> = {
  "phim-bo": { type: "SERIES", label: "Phim bộ" },
  "phim-le": { type: "SINGLE", label: "Phim lẻ" },
  "hoat-hinh": { type: "ANIMATION", label: "Hoạt hình" },
  "tv-shows": { type: "TVSHOW", label: "TV Shows" },
};

export const STATUS_PARAMS: Record<string, { status: MovieStatus; label: string }> = {
  "dang-chieu": { status: "ONGOING", label: "Đang chiếu" },
  "hoan-thanh": { status: "COMPLETED", label: "Hoàn thành" },
  "sap-chieu": { status: "UPCOMING", label: "Sắp chiếu" },
};

export const FILTER_KEYS = ["loai", "the-loai", "quoc-gia", "nam", "trang-thai", "sap-xep"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function parsePage(value: string | string[] | undefined) {
  const page = Number.parseInt(first(value) ?? "1", 10);
  return Number.isFinite(page) && page >= 1 ? Math.min(page, 1000) : 1;
}

/**
 * SEO cho trang danh sách:
 * - không lọc: canonical trỏ về chính trang (giữ ?trang=N — mỗi trang phân trang là một trang riêng)
 * - đang lọc / sắp xếp: noindex nhưng vẫn follow, để hàng nghìn tổ hợp bộ lọc không bị coi là trang trùng
 */
export function listPageSeo(basePath: string, searchParams: SearchParams): Metadata {
  if (FILTER_KEYS.some((key) => first(searchParams[key]))) return { robots: { index: false, follow: true } };
  const page = parsePage(searchParams.trang);
  return { alternates: { canonical: page > 1 ? `${basePath}?trang=${page}` : basePath } };
}

/** Đọc bộ lọc từ searchParams và gộp với bộ lọc cố định của trang (ví dụ /the-loai/hanh-dong). */
export function parseFilters(searchParams: SearchParams, base: MovieFilters = {}) {
  const raw: Record<string, string | undefined> = {};
  for (const key of FILTER_KEYS) raw[key] = first(searchParams[key]) || undefined;

  const year = raw.nam ? Number.parseInt(raw.nam, 10) : undefined;
  const sort = raw["sap-xep"] && raw["sap-xep"] in SORT_OPTIONS ? (raw["sap-xep"] as SortKey) : undefined;
  const filters: MovieFilters = {
    type: (raw.loai && TYPE_PARAMS[raw.loai]?.type) || undefined,
    genre: raw["the-loai"]?.slice(0, 60),
    country: raw["quoc-gia"]?.slice(0, 60),
    year: year && year > 1900 && year < 2100 ? year : undefined,
    status: (raw["trang-thai"] && STATUS_PARAMS[raw["trang-thai"]]?.status) || undefined,
    sort,
    ...Object.fromEntries(Object.entries(base).filter(([, v]) => v !== undefined)),
  };
  return { filters, page: parsePage(searchParams.trang), raw };
}
