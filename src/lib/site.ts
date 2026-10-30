import type { MovieStatus, MovieType } from "@/generated/prisma/enums";

export const SITE_NAME = process.env.SITE_NAME ?? "Web Phim";
/** Trên Vercel, chưa đặt SITE_URL thì dùng domain production do Vercel cấp (*.vercel.app hoặc domain riêng). */
export const SITE_URL = (
  process.env.SITE_URL?.trim() ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/+$/, "");
export const PAGE_SIZE = 24;

/** Tập thêm vào sau khi phim đã có trên web quá chừng này mới tính là "tập mới" (không tính lúc nhập cả bộ phim). */
export const NEW_EPISODE_GRACE_MINUTES = 10;

/** Ngày theo giờ Việt Nam, dạng YYYY-MM-DD. */
export const vnDate = (date: Date) => new Date(date.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

/** `count` ngày gần nhất theo giờ Việt Nam, bắt đầu từ hôm nay. */
export const recentVnDays = (count: number, now = new Date()) =>
  Array.from({ length: count }, (_, i) => vnDate(new Date(now.getTime() - i * 86_400_000)));

/** Danh sách theo loại: /danh-sach/[slug]. "anime" = hoạt hình Nhật Bản. */
export const LIST_TYPES = {
  "phim-moi": { title: "Phim mới cập nhật", type: undefined, anime: false },
  "phim-bo": { title: "Phim bộ", type: "SERIES", anime: false },
  "phim-le": { title: "Phim lẻ", type: "SINGLE", anime: false },
  "hoat-hinh": { title: "Hoạt hình", type: "ANIMATION", anime: false },
  anime: { title: "Anime", type: "ANIMATION", anime: true },
  "tv-shows": { title: "TV Shows", type: "TVSHOW", anime: false },
} as const satisfies Record<string, { title: string; type: MovieType | undefined; anime: boolean }>;

export type ListTypeSlug = keyof typeof LIST_TYPES;

export const TYPE_LABELS: Record<MovieType, string> = {
  SINGLE: "Phim lẻ",
  SERIES: "Phim bộ",
  ANIMATION: "Hoạt hình",
  TVSHOW: "TV Show",
};

export const STATUS_LABELS: Record<MovieStatus, string> = {
  ONGOING: "Đang chiếu",
  COMPLETED: "Hoàn thành",
  UPCOMING: "Sắp chiếu",
  UNKNOWN: "Đang cập nhật",
};

export const SORT_OPTIONS = {
  moi: "Mới cập nhật",
  "xem-nhieu": "Xem nhiều",
  nam: "Năm phát hành",
  ten: "Tên A–Z",
} as const;

export type SortKey = keyof typeof SORT_OPTIONS;

/** Thể loại hiển thị trên menu — cố định để header không cần truy vấn DB. */
export const NAV_GENRES = [
  ["hanh-dong", "Hành Động"], ["tinh-cam", "Tình Cảm"], ["hai-huoc", "Hài Hước"], ["co-trang", "Cổ Trang"],
  ["tam-ly", "Tâm Lý"], ["hinh-su", "Hình Sự"], ["chien-tranh", "Chiến Tranh"], ["the-thao", "Thể Thao"],
  ["vo-thuat", "Võ Thuật"], ["vien-tuong", "Viễn Tưởng"], ["phieu-luu", "Phiêu Lưu"], ["khoa-hoc", "Khoa Học"],
  ["kinh-di", "Kinh Dị"], ["am-nhac", "Âm Nhạc"], ["than-thoai", "Thần Thoại"], ["tai-lieu", "Tài Liệu"],
  ["gia-dinh", "Gia Đình"], ["chinh-kich", "Chính Kịch"], ["bi-an", "Bí Ẩn"], ["hoc-duong", "Học Đường"],
  ["kinh-dien", "Kinh Điển"], ["phim-ngan", "Phim Ngắn"], ["tre-em", "Trẻ Em"], ["mien-tay", "Miền Tây"],
] as const;

export const NAV_COUNTRIES = [
  ["trung-quoc", "Trung Quốc"], ["han-quoc", "Hàn Quốc"], ["nhat-ban", "Nhật Bản"], ["au-my", "Âu Mỹ"],
  ["thai-lan", "Thái Lan"], ["dai-loan", "Đài Loan"], ["hong-kong", "Hồng Kông"], ["viet-nam", "Việt Nam"],
  ["an-do", "Ấn Độ"], ["anh", "Anh"], ["phap", "Pháp"], ["canada", "Canada"],
  ["duc", "Đức"], ["tay-ban-nha", "Tây Ban Nha"], ["philippines", "Philippines"], ["quoc-gia-khac", "Quốc gia khác"],
] as const;

export const REPORT_REASONS = {
  "khong-phat": "Không phát được",
  "sai-tap": "Sai tập / sai phim",
  "chat-luong": "Chất lượng kém / lệch phụ đề",
  khac: "Lý do khác",
} as const;

export const movieUrl =(slug: string) => `/phim/${slug}`;
export const watchUrl = (slug: string, episodeKey: string) => `/xem/${slug}/tap-${episodeKey}`;

/** "/xem/abc/tap-12" → "12" */
export const episodeKeyFromParam = (param: string) => decodeURIComponent(param).replace(/^tap-/, "");
