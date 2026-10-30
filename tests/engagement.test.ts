import { describe, expect, it } from "vitest";
import { buildNotifications, type NewEpisodeRow } from "@/ingest/notify";
import { listPageSeo } from "@/lib/filters";
import { recentVnDays, vnDate } from "@/lib/site";

const row = (userId: number, movieId: number, key: string, sortOrder = Number(key)): NewEpisodeRow => ({
  userId,
  movieId,
  slug: `phim-${movieId}`,
  movieName: `Phim ${movieId}`,
  posterUrl: null,
  episodeKey: key,
  episodeName: `Tập ${key}`,
  sortOrder,
});

describe("thông báo tập mới", () => {
  it("mỗi phim một thông báo, mở tập mới nhất", () => {
    const result = buildNotifications([row(1, 10, "101"), row(1, 10, "102"), row(1, 20, "5")]);
    const payloads = result.get(1)!;
    expect(payloads).toHaveLength(2);
    expect(payloads[0]).toMatchObject({ title: "Phim 10", body: "Đã có 2 tập mới, mới nhất: Tập 102", url: "/xem/phim-10/tap-102", tag: "movie-10" });
    expect(payloads[1]).toMatchObject({ body: "Đã có Tập 5", url: "/xem/phim-20/tap-5" });
  });

  it("nhiều phim cùng lúc thì gộp thành một thông báo", () => {
    const result = buildNotifications([row(1, 1, "1"), row(1, 2, "1"), row(1, 3, "1"), row(1, 4, "1")]);
    expect(result.get(1)).toEqual([expect.objectContaining({ body: expect.stringContaining("4 phim"), url: "/tai-khoan/yeu-thich" })]);
  });

  it("tách riêng từng người", () => {
    const result = buildNotifications([row(1, 10, "3"), row(2, 10, "3")]);
    expect([...result.keys()].sort()).toEqual([1, 2]);
  });
});

describe("SEO trang danh sách", () => {
  it("trang không lọc: canonical về chính nó, giữ số trang", () => {
    expect(listPageSeo("/the-loai/hanh-dong", {})).toEqual({ alternates: { canonical: "/the-loai/hanh-dong" } });
    expect(listPageSeo("/the-loai/hanh-dong", { trang: "3" })).toEqual({ alternates: { canonical: "/the-loai/hanh-dong?trang=3" } });
  });

  it("trang đang lọc: noindex nhưng vẫn follow", () => {
    expect(listPageSeo("/danh-sach/phim-bo", { "sap-xep": "xem-nhieu" })).toEqual({ robots: { index: false, follow: true } });
  });
});

describe("ngày theo giờ Việt Nam", () => {
  it("17:30 UTC đã là ngày hôm sau ở Việt Nam", () => {
    expect(vnDate(new Date("2026-10-30T17:30:00Z"))).toBe("2026-10-31");
    expect(recentVnDays(3, new Date("2026-11-01T01:00:00Z"))).toEqual(["2026-11-01", "2026-10-31", "2026-10-30"]);
  });
});
