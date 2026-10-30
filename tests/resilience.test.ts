import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pauseDurationMs } from "@/ingest/sync";
import { sameMovie } from "@/ingest/rescue";
import { parseKkDetail, parseKkSearch } from "@/sources/kkphim/adapter";
import { parseNcSearch } from "@/sources/nguonc/adapter";
import { SourceBlockedError, SourceClient } from "@/sources/http";
import { tmdbKey, tmdbRefFromKey } from "@/sources/normalize";

const fixture = (name: string) =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, "fixtures", name), "utf8")) as unknown;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

/** Client không chờ thật giữa các lần thử. */
const client = (bases = ["https://a.test"]) => new SourceClient("test", bases, 1, () => Promise.resolve());

afterEach(() => vi.unstubAllGlobals());

describe("SourceClient", () => {
  it("trả JSON khi thành công và null khi 404", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ ok: 1 })).mockResolvedValueOnce(new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const http = client();
    expect(await http.getJson("/x")).toEqual({ ok: 1 });
    expect(await http.getJson("/y")).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe("https://a.test/x");
  });

  it("gặp 429 thì thử lại (không bỏ cuộc ngay)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "1" } }))
      .mockResolvedValueOnce(json({ ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await client().getJson("/x")).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gặp 403 thì dừng ngay, không thử lại", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("blocked", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(client().getJson("/x")).rejects.toBeInstanceOf(SourceBlockedError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("domain chính lỗi mạng thì chuyển sang mirror", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://old.test")) throw new TypeError("fetch failed");
      return json({ from: "mirror" });
    });
    vi.stubGlobal("fetch", fetchMock);
    const http = client(["https://old.test", "https://new.test/"]);
    expect(await http.getJson("/phim/x")).toEqual({ from: "mirror" });
    expect(http.activeBaseUrl).toBe("https://new.test");
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("https://new.test/phim/x");
  });

  it("trang lỗi HTML thay vì JSON được coi là lỗi và thử lại", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("<html>Attention Required</html>", { status: 200 }))
      .mockResolvedValueOnce(json({ ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await client().getJson("/x")).toEqual({ ok: 1 });
  });

  it("lỗi 5xx liên tiếp quá ngưỡng thì báo nguồn đang sập / chặn", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    const http = client();
    await expect(http.getJson("/a")).rejects.toThrow();
    await expect(http.getJson("/b")).rejects.toBeInstanceOf(SourceBlockedError);
  });
});

describe("circuit breaker", () => {
  it("tạm dừng 15 phút, 30 phút, 1 giờ… tối đa 6 giờ", () => {
    expect(pauseDurationMs(1)).toBe(15 * 60_000);
    expect(pauseDurationMs(2)).toBe(30 * 60_000);
    expect(pauseDurationMs(3)).toBe(60 * 60_000);
    expect(pauseDurationMs(20)).toBe(6 * 60 * 60_000);
  });
});

describe("tìm nguồn thay thế", () => {
  it("KKPhim lưu link m3u8 gốc để kiểm tra sống/chết", () => {
    const movie = parseKkDetail(fixture("kkphim/detail-single.json"))!;
    expect(movie.episodes[0].links[0].streamUrl).toMatch(/\.m3u8$/);
  });

  it("đọc kết quả tìm kiếm của cả hai nguồn kèm TMDB", () => {
    const kk = parseKkSearch(fixture("kkphim/search.json"));
    expect(kk.find((h) => h.slug === "duoi-day-ho")?.tmdb).toEqual({ type: "movie", id: 1404978, season: null });
    const nc = parseNcSearch(fixture("nguonc/search.json"));
    expect(nc.find((h) => h.slug === "the-lake-phan-2")?.tmdb).toEqual({ type: "tv", id: 158051, season: 2 });
  });

  it("tra theo TMDB của KKPhim trả đúng phim và season", () => {
    const movie = parseKkDetail(fixture("kkphim/detail-tmdb.json"))!;
    expect(tmdbKey(movie.tmdb)).toBe("tv:293124:2");
  });

  it("tmdbRefFromKey là nghịch đảo của tmdbKey", () => {
    expect(tmdbRefFromKey("tv:293124:2")).toEqual({ type: "tv", id: 293124, season: 2 });
    expect(tmdbRefFromKey("movie:1404978:0")).toEqual({ type: "movie", id: 1404978, season: null });
    expect(tmdbRefFromKey("rác")).toBeNull();
  });

  it("chỉ ghép phim khi chắc chắn", () => {
    const lake = { originName: "The Lake", year: 2025, tmdbKey: "movie:1404978:0" };
    expect(sameMovie(lake, { originName: "The Lake", year: 2022, tmdbKey: "movie:709716:0" })).toBe(false);
    expect(sameMovie(lake, { originName: "Tên khác", year: 2025, tmdbKey: "movie:1404978:0" })).toBe(true);
    // Không có TMDB: cần cùng tên gốc VÀ cùng năm
    const noTmdb = { originName: "The Lake (Season 1)", year: 2022, tmdbKey: null };
    expect(sameMovie(noTmdb, { originName: "The Lake (Season 1)", year: 2022, tmdbKey: null })).toBe(true);
    expect(sameMovie(noTmdb, { originName: "The Lake (Season 1)", year: null, tmdbKey: null })).toBe(false);
  });
});
