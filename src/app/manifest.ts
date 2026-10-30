import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/site";

/** Web App Manifest: cho phép cài web lên màn hình chính như một ứng dụng (PWA). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${SITE_NAME} – Xem phim online`,
    short_name: SITE_NAME,
    description: "Phim bộ, phim lẻ, hoạt hình, anime Vietsub và thuyết minh, có thông báo khi phim yêu thích ra tập mới.",
    lang: "vi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#07080c",
    theme_color: "#07080c",
    categories: ["entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Tập mới hôm nay", url: "/tap-moi", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Phim yêu thích", url: "/tai-khoan/yeu-thich", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Lịch sử xem", url: "/tai-khoan/lich-su", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
