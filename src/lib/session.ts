import { jwtVerify, SignJWT } from "jose";

/** Phần ký/đọc phiên chỉ dùng jose, để chạy được cả trong proxy.ts. */
export const SESSION_COOKIE = "phim_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 ngày

export type SessionRole = "USER" | "ADMIN";

export interface Session {
  userId: number;
  name: string;
  role: SessionRole;
}

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET chưa đặt hoặc quá ngắn (cần ≥ 32 ký tự)");
  return new TextEncoder().encode(secret);
}

export async function signSession(session: Session): Promise<string> {
  return new SignJWT({ name: session.name, role: session.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(session.userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId)) return null;
    return {
      userId,
      name: typeof payload.name === "string" ? payload.name : "",
      role: payload.role === "ADMIN" ? "ADMIN" : "USER",
    };
  } catch {
    return null;
  }
}
