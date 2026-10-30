"use server";

import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { pushConfig, sendPush } from "@/lib/push";
import { SITE_NAME } from "@/lib/site";

/** Số thiết bị nhận thông báo tối đa mỗi tài khoản (giữ các thiết bị mới nhất). */
const MAX_DEVICES = 10;

const subscriptionInput = z.object({
  endpoint: z.url().max(1000).refine((url) => url.startsWith("https://")),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Lưu thiết bị vừa bật thông báo tập mới cho tài khoản đang đăng nhập. */
export async function savePushSubscription(input: unknown): Promise<{ ok: true } | { error: "login" | "invalid" | "unavailable" }> {
  if (!pushConfig()) return { error: "unavailable" };
  const session = await getSession();
  if (!session) return { error: "login" };
  const parsed = subscriptionInput.safeParse(input);
  if (!parsed.success) return { error: "invalid" };

  const { endpoint, keys } = parsed.data;
  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: session.userId },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId: session.userId },
  });
  const extra = await db.pushSubscription.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    skip: MAX_DEVICES,
    select: { id: true },
  });
  if (extra.length > 0) await db.pushSubscription.deleteMany({ where: { id: { in: extra.map((s) => s.id) } } });
  return { ok: true };
}

export async function removePushSubscription(endpoint: string) {
  const session = await getSession();
  if (!session || typeof endpoint !== "string") return;
  await db.pushSubscription.deleteMany({ where: { endpoint, userId: session.userId } });
}

/** Gửi thử một thông báo tới thiết bị đang dùng, để người xem biết đã bật thành công. */
export async function sendTestPush(endpoint: string): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session || typeof endpoint !== "string") return { ok: false };
  const target = await db.pushSubscription.findUnique({ where: { endpoint } });
  if (!target || target.userId !== session.userId) return { ok: false };
  const result = await sendPush(target, {
    title: SITE_NAME,
    body: "Đã bật thông báo tập mới trên thiết bị này.",
    url: "/tai-khoan/yeu-thich",
    tag: "test",
  });
  if (result === "gone") await db.pushSubscription.delete({ where: { id: target.id } });
  return { ok: result === "ok" };
}
