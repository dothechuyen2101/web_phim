import { describe, expect, it } from "vitest";
import {
  absoluteUrl, buildEpisodes, inferStatus, matchKey, normalizeGenres, parseEpisodeKey, parseTmdb, slugify,
  stripHtml, tmdbKey, toNameList, toSearchText,
} from "@/sources/normalize";

describe("slugify / toSearchText", () => {
  it("bỏ dấu tiếng Việt, kể cả chữ đ", () => {
    expect(slugify("Dưới Đáy Hồ")).toBe("duoi-day-ho");
    expect(slugify("  Phim 18+  ")).toBe("phim-18");
    expect(toSearchText("Dưới Đáy Hồ", "The Lake", null)).toBe("duoi day ho the lake");
  });
});

describe("absoluteUrl", () => {
  it("ghép đường dẫn tương đối với CDN", () => {
    expect(absoluteUrl("uploads/movies/a.webp", "https://phimimg.com")).toBe("https://phimimg.com/uploads/movies/a.webp");
    expect(absoluteUrl("/uploads/a.webp", "https://phimimg.com/")).toBe("https://phimimg.com/uploads/a.webp");
  });
  it("giữ nguyên URL tuyệt đối, bỏ giá trị rỗng", () => {
    expect(absoluteUrl("https://img.nguonc.com/x.png", "https://phimimg.com")).toBe("https://img.nguonc.com/x.png");
    expect(absoluteUrl("//cdn.x/y.png", "https://a")).toBe("https://cdn.x/y.png");
    expect(absoluteUrl("", "https://a")).toBeNull();
    expect(absoluteUrl(null, "https://a")).toBeNull();
  });
});

describe("parseEpisodeKey", () => {
  it.each([
    ["Tập 01", "tap-01", "1", 1],
    ["1", "tap-1", "1", 1],
    ["Tập 12", undefined, "12", 12],
    ["Tập 8.5", undefined, "8-5", 8.5],
    ["Tập 15 END", undefined, "15", 15],
    ["Full", "full", "full", 0],
    ["FULL", "full", "full", 0],
    ["Trailer", "trailer", "trailer", -1],
  ])("%s → %s", (name, slug, key, sortOrder) => {
    expect(parseEpisodeKey(name, slug)).toEqual({ key, sortOrder });
  });

  it("giữ phần hậu tố có nghĩa để không đè lên tập thường", () => {
    expect(parseEpisodeKey("Tập 24 OVA").key).toBe("24-ova");
  });
});

describe("buildEpisodes", () => {
  it("gộp cùng một tập từ nhiều server, sắp theo thứ tự tập", () => {
    const episodes = buildEpisodes([
      { serverName: "Vietsub", items: [{ name: "Tập 02", embedUrl: "https://a/2" }, { name: "Tập 01", embedUrl: "https://a/1" }] },
      { serverName: "Thuyết Minh", items: [{ name: "1", embedUrl: "https://b/1" }, { name: "3", embedUrl: "" }] },
    ]);
    expect(episodes.map((e) => e.key)).toEqual(["1", "2"]);
    expect(episodes[0].links).toEqual([
      { serverName: "Vietsub", embedUrl: "https://a/1" },
      { serverName: "Thuyết Minh", embedUrl: "https://b/1" },
    ]);
    expect(episodes[0].name).toBe("Tập 1");
  });
});

describe("inferStatus", () => {
  it.each([
    ["completed", "Tập 3", null, "COMPLETED"],
    [null, "Hoàn Tất (40/40)", 40, "COMPLETED"],
    [null, "FULL", 1, "COMPLETED"],
    [null, "Tập 5", 6, "ONGOING"],
    [null, "Tập 6", 6, "COMPLETED"],
    [null, "Tập 7/16", null, "ONGOING"],
    [null, "Trailer", null, "UPCOMING"],
    [null, null, null, "UNKNOWN"],
  ] as const)("%s / %s → %s", (raw, current, total, expected) => {
    expect(inferStatus(raw, current, total)).toBe(expected);
  });
});

describe("tmdb / matchKey", () => {
  it("chuẩn hóa id dạng chuỗi và dạng số về cùng một khóa", () => {
    const fromKk = parseTmdb({ type: "movie", id: "1404978", season: null });
    const fromNc = parseTmdb({ type: "movie", id: 1404978, season: null });
    expect(tmdbKey(fromKk)).toBe("movie:1404978:0");
    expect(tmdbKey(fromNc)).toBe(tmdbKey(fromKk));
  });
  it("phân biệt các season của cùng một series", () => {
    expect(tmdbKey(parseTmdb({ type: "tv", id: 293124, season: 2 }))).toBe("tv:293124:2");
    expect(tmdbKey(parseTmdb({ type: "tv", id: "293124", season: 1 }))).toBe("tv:293124:1");
  });
  it("bỏ qua tmdb không hợp lệ", () => {
    expect(parseTmdb({ type: "tv", id: null })).toBeNull();
    expect(parseTmdb(null)).toBeNull();
  });
  it("matchKey dựa trên tên gốc + năm + loại", () => {
    expect(matchKey("The Lake", 2025, "SINGLE")).toBe("the-lake|2025|SINGLE");
    expect(matchKey("", 2025, "SINGLE")).toBeNull();
  });
});

describe("misc", () => {
  it("normalizeGenres quy tên thể loại nguồn khác về bộ chuẩn và bỏ thể loại lạ", () => {
    expect(normalizeGenres([{ name: "Giả tưởng" }, { name: "Khoa học viễn tưởng" }, { name: "Gây Cấn" }, { name: "Kinh dị" }]))
      .toEqual([{ slug: "vien-tuong", name: "Giả tưởng" }, { slug: "kinh-di", name: "Kinh dị" }]);
  });
  it("toNameList nhận mảng hoặc chuỗi phân cách dấu phẩy", () => {
    expect(toNameList("A, B ,C")).toEqual(["A", "B", "C"]);
    expect(toNameList(["Đang cập nhật"])).toEqual([]);
    expect(toNameList(null)).toEqual([]);
  });
  it("stripHtml giữ xuống dòng giữa các đoạn và giải mã entity", () => {
    expect(stripHtml("<p>A &amp; B</p><p>C&#39;s</p>")).toBe("A & B\nC's");
  });
});
