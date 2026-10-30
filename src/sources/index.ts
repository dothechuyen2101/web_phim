import { KKPhimAdapter } from "./kkphim/adapter";
import { NguonCAdapter } from "./nguonc/adapter";
import type { SourceAdapter } from "./types";
import { VSMovAdapter } from "./vsmov/adapter";

/** Danh sách nguồn mặc định (seed vào bảng Source). baseUrl và mirror sửa được trong trang admin. */
export const DEFAULT_SOURCES = [
  { key: "kkphim", name: "KKPhim", baseUrl: "https://phimapi.com", priority: 10 },
  { key: "nguonc", name: "NguonC", baseUrl: "https://phim.nguonc.com/api", priority: 5 },
  // Nguồn phụ thứ ba: thêm server dự phòng và phim hai nguồn kia thiếu (chậm hơn KKPhim với hoạt hình TQ)
  { key: "vsmov", name: "VSMov", baseUrl: "https://vsmov.com/api", priority: 3 },
] as const;

/** Domain chính đứng đầu, sau đó là các mirror (dùng khi domain chính lỗi mạng / 5xx). */
export function createAdapter(source: { key: string; baseUrl: string; mirrors?: string[] }): SourceAdapter {
  const baseUrls = [source.baseUrl, ...(source.mirrors ?? [])].map((u) => u.trim()).filter(Boolean);
  switch (source.key) {
    case "kkphim":
      return new KKPhimAdapter(baseUrls);
    case "nguonc":
      return new NguonCAdapter(baseUrls);
    case "vsmov":
      return new VSMovAdapter(baseUrls);
    default:
      throw new Error(`Chưa có adapter cho nguồn "${source.key}"`);
  }
}
