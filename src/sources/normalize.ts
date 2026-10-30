import type { MovieStatus, MovieType } from "@/generated/prisma/enums";
import type { NormalizedEpisode, TmdbRef } from "./types";

/** Thể loại không đồng bộ vì web để public. */
export const ADULT_GENRE_SLUGS = new Set(["phim-18"]);

/** Bộ thể loại chuẩn của web (lấy theo KKPhim). Nguồn khác được quy về bộ này. */
export const KNOWN_GENRE_SLUGS = new Set([
  "bi-an", "chien-tranh", "chinh-kich", "co-trang", "gia-dinh", "hai-huoc", "hanh-dong",
  "hinh-su", "hoc-duong", "khoa-hoc", "kinh-di", "kinh-dien", "lich-su", "mien-tay",
  "phim-18", "phim-ngan", "phieu-luu", "than-thoai", "the-thao", "tre-em", "tai-lieu",
  "tam-ly", "tinh-cam", "vien-tuong", "vo-thuat", "am-nhac",
]);

/** Thể loại của nguồn khác → slug tương ứng trong bộ chuẩn. */
export const GENRE_ALIASES: Record<string, string> = {
  "gia-tuong": "vien-tuong",
  "khoa-hoc-vien-tuong": "vien-tuong",
  "lang-man": "tinh-cam",
  hai: "hai-huoc",
  "phim-hai": "hai-huoc",
  nhac: "am-nhac",
  "phim-nhac": "am-nhac",
};

export function removeDiacritics(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function slugify(input: string): string {
  return removeDiacritics(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Chuỗi phục vụ tìm kiếm: bỏ dấu, viết thường, gộp khoảng trắng. */
export function toSearchText(...parts: (string | null | undefined)[]): string {
  return removeDiacritics(parts.filter(Boolean).join(" "))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function absoluteUrl(url: string | null | undefined, base: string): string | null {
  const value = url?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  return `${base.replace(/\/+$/, "")}/${value.replace(/^\/+/, "")}`;
}

export function toInt(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : null;
  if (typeof value !== "string") return null;
  const match = value.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
}

export function toDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const PLACEHOLDER_NAMES = new Set(["dang cap nhat", "updating", "n/a", ""]);

/** Nhận mảng hoặc chuỗi "A, B, C"; bỏ các giá trị giữ chỗ như "Đang cập nhật". */
export function toNameList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return raw
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => !PLACEHOLDER_NAMES.has(removeDiacritics(v).toLowerCase()));
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'",
};

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#?\w+);/g, (m, name: string) => {
      if (ENTITIES[name]) return ENTITIES[name];
      if (name.startsWith("#")) {
        const code = name[1] === "x" ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return m;
    })
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

const EPISODE_SUFFIX_NOISE = /\b(end|het|cuoi|final|vietsub|thuyet minh|long tieng)\b/g;

/**
 * Chuẩn hóa tên tập để tập của các nguồn khớp nhau:
 * "Tập 01" | "1" | "tap-01" → "1"; "Tập 8.5" → "8-5"; "Full"/"FULL" → "full".
 */
export function parseEpisodeKey(name: string, slug?: string): { key: string; sortOrder: number } {
  const candidates = [name, slug].filter((v): v is string => !!v && v.trim() !== "");
  for (const candidate of candidates) {
    const text = removeDiacritics(candidate).toLowerCase().trim().replace(/^tap[\s\-_:]*/, "");
    const match = text.match(/^0*(\d+)(?:[.\-_](\d+))?(?!\d)(.*)$/);
    if (!match) continue;
    const main = Number.parseInt(match[1], 10);
    const sub = match[2];
    const rest = slugify(match[3].replace(EPISODE_SUFFIX_NOISE, " "));
    let key = sub ? `${main}-${sub}` : `${main}`;
    let sortOrder = sub ? Number.parseFloat(`${main}.${sub}`) : main;
    if (rest) {
      key = `${key}-${rest}`;
      sortOrder += 0.001;
    }
    return { key, sortOrder };
  }
  const key = slugify(candidates[0] ?? "") || "tap";
  const sortOrder = key === "trailer" ? -1 : key === "full" ? 0 : 100_000;
  return { key, sortOrder };
}

export function episodeLabel(key: string, fallback: string): string {
  if (/^\d+(-\d+)?$/.test(key)) return `Tập ${key.replace("-", ".")}`;
  if (key === "full") return "Full";
  return fallback.trim() || key;
}

/** Gom các server của một nguồn thành danh sách tập, mỗi tập có nhiều link (một link / server). */
export function buildEpisodes(
  servers: {
    serverName: string;
    items: { name: string; slug?: string; embedUrl: string | null | undefined; streamUrl?: string | null }[];
  }[],
): NormalizedEpisode[] {
  const byKey = new Map<string, NormalizedEpisode>();
  for (const server of servers) {
    // Có nguồn trả tên server lẫn xuống dòng / nhiều khoảng trắng ("Vietsub\r\n      #1")
    const serverName = server.serverName.replace(/\s+/g, " ").trim() || "Server";
    for (const item of server.items) {
      const embedUrl = item.embedUrl?.trim();
      if (!embedUrl || !/^https?:\/\//i.test(embedUrl)) continue;
      const { key, sortOrder } = parseEpisodeKey(item.name, item.slug);
      let episode = byKey.get(key);
      if (!episode) {
        episode = { key, name: episodeLabel(key, item.name), sortOrder, links: [] };
        byKey.set(key, episode);
      }
      if (!episode.links.some((link) => link.serverName === serverName)) {
        const streamUrl = item.streamUrl?.trim();
        episode.links.push({ serverName, embedUrl, ...(streamUrl && /^https?:\/\//i.test(streamUrl) ? { streamUrl } : {}) });
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Suy ra trạng thái từ chuỗi kiểu "Tập 5", "Hoàn Tất (40/40)", "FULL", "Trailer". */
export function inferStatus(raw: string | null | undefined, episodeCurrent: string | null, episodeTotal: number | null): MovieStatus {
  switch (raw?.toLowerCase()) {
    case "completed":
      return "COMPLETED";
    case "ongoing":
      return "ONGOING";
    case "trailer":
      return "UPCOMING";
  }
  const text = removeDiacritics(episodeCurrent ?? "").toLowerCase();
  if (!text) return "UNKNOWN";
  if (text.includes("trailer")) return "UPCOMING";
  if (text.includes("full") || text.includes("hoan tat") || text.includes("hoan thanh")) return "COMPLETED";
  const ratio = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (ratio) return Number(ratio[1]) >= Number(ratio[2]) ? "COMPLETED" : "ONGOING";
  const current = toInt(text);
  if (current !== null && episodeTotal && current >= episodeTotal) return "COMPLETED";
  return current !== null ? "ONGOING" : "UNKNOWN";
}

export function parseTmdb(value: unknown): TmdbRef | null {
  if (!value || typeof value !== "object") return null;
  const ref = value as { type?: unknown; id?: unknown; season?: unknown };
  const id = toInt(ref.id);
  if (!id || (ref.type !== "movie" && ref.type !== "tv")) return null;
  return { type: ref.type, id, season: ref.type === "tv" ? toInt(ref.season) : null };
}

export function tmdbKey(ref: TmdbRef | null): string | null {
  return ref ? `${ref.type}:${ref.id}:${ref.season ?? 0}` : null;
}

/** "tv:293124:2" → { type: "tv", id: 293124, season: 2 } */
export function tmdbRefFromKey(key: string | null | undefined): TmdbRef | null {
  const match = key?.match(/^(movie|tv):(\d+):(\d+)$/);
  if (!match) return null;
  const type = match[1] as TmdbRef["type"];
  return { type, id: Number(match[2]), season: type === "tv" ? Number(match[3]) : null };
}

export function matchKey(originName: string, year: number | null, type: MovieType): string | null {
  const name = slugify(originName);
  return name ? `${name}|${year ?? ""}|${type}` : null;
}

export function normalizeGenres(names: { name: string; slug?: string }[]) {
  const seen = new Map<string, string>();
  for (const { name, slug } of names) {
    const raw = slug || slugify(name);
    const canonical = GENRE_ALIASES[raw] ?? raw;
    if (KNOWN_GENRE_SLUGS.has(canonical) && !seen.has(canonical)) seen.set(canonical, name);
  }
  return [...seen].map(([slug, name]) => ({ slug, name }));
}
