import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession, type Session } from "@/lib/session";

export type { Session };
export { hashPassword, verifyPassword } from "@/lib/password";

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  // Kiểm tra hạn JWT dùng thời gian hiện tại: chỉ làm lúc có request thật, không làm khi Next prerender trước
  await connection();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function startSession(session: Session) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function requireUser(nextPath = "/"): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/dang-nhap?next=${encodeURIComponent(nextPath)}`);
  return session;
}

/**
 * Kiểm tra quyền admin dựa trên DB (không tin role trong cookie), để thu hồi quyền có hiệu lực ngay.
 * Người không phải admin nhận 404 để không lộ sự tồn tại của trang quản trị.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await requireUser("/admin");
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { role: true } });
  if (user?.role !== "ADMIN") notFound();
  return session;
}
