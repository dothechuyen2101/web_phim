import { removePushSubscription, savePushSubscription } from "@/app/actions/push";

/** Khóa công khai VAPID (nhúng lúc build). Trống = server chưa cấu hình thông báo, ẩn mọi nút liên quan. */
export const PUSH_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/**
 * - on / off: thiết bị này đang bật / chưa bật
 * - ios: iPhone/iPad mở bằng Safari — chỉ nhận được thông báo khi web đã được thêm vào màn hình chính
 * - denied: người dùng đã chặn thông báo của web trong trình duyệt
 */
export type PushState = "on" | "off" | "denied" | "ios" | "unsupported" | "unavailable";

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function registerServiceWorker() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

export async function currentPushSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function getPushState(): Promise<PushState> {
  if (!PUSH_PUBLIC_KEY) return "unavailable";
  if (!pushSupported()) return isIOS() && !isStandalone() ? "ios" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  return Notification.permission === "granted" && (await currentPushSubscription()) ? "on" : "off";
}

function base64UrlToBytes(value: string) {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(current: ArrayBuffer | null, expected: Uint8Array) {
  if (!current || current.byteLength !== expected.length) return false;
  const bytes = new Uint8Array(current);
  return expected.every((byte, i) => bytes[i] === byte);
}

/** Bật thông báo trên thiết bị này (hỏi quyền, đăng ký với trình duyệt rồi lưu lên server). */
export async function enablePush(): Promise<"ok" | "denied" | "login" | "error"> {
  // Chỉ hỏi quyền khi chưa có (đã cho phép từ trước thì không hỏi lại)
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  try {
    const registration = await registerServiceWorker();
    await navigator.serviceWorker.ready;
    const key = base64UrlToBytes(PUSH_PUBLIC_KEY);
    let subscription = await registration.pushManager.getSubscription();
    // Đăng ký cũ tạo bằng khóa VAPID khác (server đã đổi khóa) thì không gửi được nữa: hủy rồi đăng ký lại
    if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
      await subscription.unsubscribe();
      subscription = null;
    }
    subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const result = await savePushSubscription(subscription.toJSON());
    if ("ok" in result) return "ok";
    return result.error === "login" ? "login" : "error";
  } catch (error) {
    console.warn("[push] không bật được thông báo:", error);
    return "error";
  }
}

/** Đăng ký trên thiết bị còn nhưng server có thể chưa có (đổi tài khoản, server xóa nhầm): gửi lại cho chắc. */
export async function resyncPush() {
  const subscription = await currentPushSubscription();
  if (subscription) await savePushSubscription(subscription.toJSON()).catch(() => {});
}

export async function disablePush() {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await removePushSubscription(subscription.endpoint).catch(() => {});
  await subscription.unsubscribe();
}
