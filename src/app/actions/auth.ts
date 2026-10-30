"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { endSession, hashPassword, startSession, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export interface FormState {
  error?: string;
  message?: string;
}

/** Chỉ cho chuyển hướng về đường dẫn nội bộ, tránh open redirect. */
function safeNext(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

const credentials = z.object({
  email: z.email("Email không hợp lệ").max(200).transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự").max(128),
});

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  if (!(await rateLimit("login", 10, 15 * 60_000))) {
    return { error: "Bạn thử quá nhiều lần. Vui lòng đợi 15 phút." };
  }
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Email hoặc mật khẩu không đúng." };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
    return { error: "Email hoặc mật khẩu không đúng." };
  }
  await startSession({ userId: user.id, name: user.name, role: user.role });
  redirect(safeNext(formData.get("next")));
}

const registration = credentials.extend({
  name: z.string().trim().min(2, "Tên hiển thị tối thiểu 2 ký tự").max(40, "Tên hiển thị tối đa 40 ký tự"),
});

export async function register(_: FormState, formData: FormData): Promise<FormState> {
  if (!(await rateLimit("register", 5, 60 * 60_000))) {
    return { error: "Bạn đăng ký quá nhiều lần. Vui lòng thử lại sau." };
  }
  const parsed = registration.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Thông tin không hợp lệ." };
  if (formData.get("password") !== formData.get("confirm")) return { error: "Mật khẩu nhập lại không khớp." };

  const { name, email, password } = parsed.data;
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    return { error: "Email này đã được đăng ký." };
  }
  const user = await db.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
  await startSession({ userId: user.id, name: user.name, role: user.role });
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await endSession();
  redirect("/");
}
