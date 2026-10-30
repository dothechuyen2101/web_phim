import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { tmdbKey } from "@/sources/normalize";
import { parseVsDetail, parseVsList, parseVsSearch } from "@/sources/vsmov/adapter";

const fixture = (name: string) =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, "fixtures", "vsmov", name), "utf8")) as unknown;

describe("VSMov", () => {
  it("đọc danh sách mới cập nhật, thời gian có múi giờ đúng", () => {
    const page = parseVsList(fixture("list-updated.json"));
    expect(page.totalPages).toBeGreaterThan(1);
    expect(page.items[0]).toEqual({
      slug: "trach-em-qua-xinh-dep",
      modifiedAt: new Date("2026-10-30T05:26:18.000Z"),
    });
  });

  it("đọc phim hoạt hình bộ: loại, link nhúng, tên server đã gọn, TMDB không rõ mùa", () => {
    const movie = parseVsDetail(fixture("detail-series.json"))!;
    expect(movie.name).toBe("Tiên Nghịch");
    expect(movie.type).toBe("ANIMATION");
    expect(movie.status).toBe("ONGOING");
    expect(movie.externalId).toBe("50761");
    expect(tmdbKey(movie.tmdb)).toBe("tv:223911:0");
    expect(movie.episodes).toHaveLength(162);
    expect(movie.episodes[0].links[0].serverName).toBe("Vietsub #1");
    expect(movie.episodes[0].links[0].embedUrl).toMatch(/^https:\/\/v\d+\.streamvsmov\.com\/video\//);
    expect(movie.episodes[0].links[0].streamUrl).toBeUndefined();
    expect(movie.genres.map((g) => g.slug).sort()).toEqual(["chinh-kich", "hanh-dong"]);
    expect(movie.countries).toEqual([{ slug: "trung-quoc", name: "Trung Quốc" }]);
    expect(movie.posterUrl).toMatch(/^https:\/\/vsmov\.com\//);
  });

  it("đọc kết quả tìm kiếm kèm TMDB", () => {
    const hits = parseVsSearch(fixture("search.json"));
    expect(hits).toEqual([
      { slug: "tien-nghich", originName: "Renegade Immortal", year: 2023, tmdb: { type: "tv", id: 223911, season: null } },
    ]);
  });
});
