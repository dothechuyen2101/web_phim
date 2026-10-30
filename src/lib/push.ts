import webpush from "web-push";
import { SITE_URL } from "@/lib/site";

/** Cấu hình Web Push (thông báo tập mới). Thiếu khóa VAPID thì tính năng tự tắt. */
export function pushConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  // VAPID bắt buộc subject là https: hoặc mailto: (localhost http thì dùng địa chỉ mẫu)
  const subject = process.env.VAPID_SUBJECT?.trim() || (SITE_URL.startsWith("https://") ? SITE_URL : "mailto:admin@example.com");
  return { publicKey, privateKey, subject };
}

export interface PushPayload {
  title: string;
  body: string;
  /** đường dẫn mở ra khi bấm vào thông báo */
  url: string;
  /** thông báo cùng tag thay thế nhau trên thiết bị (mỗi phim chỉ hiện một thông báo) */
  tag?: string;
  icon?: string | null;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** "gone": thiết bị đã hủy đăng ký (404/410) — nên xóa khỏi DB. */
export async function sendPush(target: PushTarget, payload: PushPayload): Promise<"ok" | "gone" | "error"> {
  const config = pushConfig();
  if (!config) return "error";
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      { vapidDetails: config, TTL: 12 * 60 * 60, urgency: "normal", timeout: 10_000 },
    );
    return "ok";
  } catch (error) {
    if (error instanceof webpush.WebPushError && (error.statusCode === 404 || error.statusCode === 410)) return "gone";
    console.warn(`push: gửi lỗi (${error instanceof Error ? error.message : String(error)})`);
    return "error";
  }
}
