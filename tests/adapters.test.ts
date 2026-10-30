import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { kkTime, parseKkDetail, parseKkList } from "@/sources/kkphim/adapter";
import { tmdbKey } from "@/sources/normalize";
import { parseNcDetail, parseNcList } from "@/sources/nguonc/adapter";

const fixture = (name: string) =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, "fixtures", name), "utf8")) as unknown;

describe("KKPhim", () => {
  it("đọc danh sách mới cập nhật", () => {
    const page = parseKkList(fixture("kkphim/list-updated.json"));
    expect(page.totalPages).toBeGreaterThan(1);
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items[0].slug).toBeTruthy();
    expect(page.items[0].modifiedAt).toBeInstanceOf(Date);
  });

  it("đọc phim lẻ", () => {
    const movie = parseKkDetail(fixture("kkphim/detail-single.json"))!;
    expect(movie.name).toBe("Dưới Đáy Hồ");
    expect(movie.type).toBe("SINGLE");
    expect(movie.status).toBe("COMPLETED");
    expect(movie.year).toBe(2025);
    expect(tmdbKey(movie.tmdb)).toBe("movie:1404978:0");
    expect(movie.imdbId).toBe("tt34730636");
    expect(movie.posterUrl).toMatch(/^https:\/\/phimimg\.com\//);
    expect(movie.description).not.toContain("<p>");
    expect(movie.altNames).not.toContain("Dưới Đáy Hồ");
    expect(movie.genres.map((g) => g.slug)).toContain("kinh-di");
    expect(movie.countries).toEqual([{ slug: "viet-nam", name: "Việt Nam" }]);
    expect(movie.episodes).toHaveLength(1);
    expect(movie.episodes[0].key).toBe("full");
    expect(movie.episodes[0].links[0].embedUrl).toMatch(/^https:\/\/player\.phimapi\.com\//);
  });

  it("đọc phim bộ với đủ số tập", () => {
    const movie = parseKkDetail(fixture("kkphim/detail-series.json"))!;
    expect(movie.type).toBe("SERIES");
    expect(movie.status).toBe("COMPLETED");
    expect(movie.episodes).toHaveLength(40);
    expect(movie.episodes.map((e) => e.key).slice(0, 3)).toEqual(["1", "2", "3"]);
  });

  it("đọc giờ của KKPhim theo giờ Việt Nam (nguồn gắn nhầm hậu tố Z)", () => {
    expect(kkTime("2026-10-30T11:23:12.000Z")?.toISOString()).toBe("2026-10-30T04:23:12.000Z");
    expect(kkTime(null)).toBeNull();
    const movie = parseKkDetail(fixture("kkphim/detail-single.json"))!;
    expect(movie.modifiedAt?.toISOString()).toBe("2026-10-29T18:44:41.000Z");
  });

  it("trả null khi dữ liệu không đúng dạng (ví dụ phim không tồn tại)", () => {
    expect(parseKkDetail({ status: false, msg: "Movie not found" })).toBeNull();
  });
});

describe("NguonC", () => {
  it("đọc danh sách mới cập nhật", () => {
    const page = parseNcList(fixture("nguonc/list-updated.json"));
    expect(page.totalPages).toBeGreaterThan(1);
    expect(page.items[0].modifiedAt).toBeInstanceOf(Date);
  });

  it("đọc phim lẻ và khớp TMDB với KKPhim", () => {
    const nc = parseNcDetail(fixture("nguonc/detail-single.json"))!;
    const kk = parseKkDetail(fixture("kkphim/detail-single.json"))!;
    expect(nc.type).toBe("SINGLE");
    expect(nc.status).toBe("COMPLETED");
    expect(nc.year).toBe(2025);
    expect(tmdbKey(nc.tmdb)).toBe(tmdbKey(kk.tmdb));
    expect(nc.directors).toEqual(["Trần Hữu Tấn"]);
    expect(nc.countries).toEqual([{ slug: "viet-nam", name: "Việt Nam" }]);
    expect(nc.genres.map((g) => g.slug).sort()).toEqual(["chinh-kich", "kinh-di", "vien-tuong"]);
    expect(nc.episodes[0].key).toBe("full");
    expect(nc.episodes[0].links[0].embedUrl).toMatch(/streamc\.xyz/);
  });

  it("nhận diện anime (Phim bộ + thể loại Hoạt hình) là ANIMATION, giữ season TMDB", () => {
    const nc = parseNcDetail(fixture("nguonc/detail-series.json"))!;
    expect(nc.type).toBe("ANIMATION");
    expect(nc.status).toBe("ONGOING");
    expect(tmdbKey(nc.tmdb)).toBe("tv:293124:2");
    expect(nc.countries.map((c) => c.slug)).toEqual(["nhat-ban"]);
    expect(nc.episodes.map((e) => e.key).slice(0, 2)).toEqual(["1", "2"]);
  });
});
