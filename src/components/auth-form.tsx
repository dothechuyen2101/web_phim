"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { login, register, type FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const next = useSearchParams().get("next") ?? "/";
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "login" ? login : register, {});
  const isLogin = mode === "login";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {!isLogin && (
        <label className="block space-y-1.5">
          <span className="text-sm text-muted">Tên hiển thị</span>
          <input name="name" required minLength={2} maxLength={40} autoComplete="nickname" className="field" />
        </label>
      )}
      <label className="block space-y-1.5">
        <span className="text-sm text-muted">Email</span>
        <input name="email" type="email" required autoComplete="email" className="field" />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-muted">Mật khẩu</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={isLogin ? "current-password" : "new-password"}
          className="field"
        />
      </label>
      {!isLogin && (
        <label className="block space-y-1.5">
          <span className="text-sm text-muted">Nhập lại mật khẩu</span>
          <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="field" />
        </label>
      )}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Đang xử lý…" : isLogin ? "Đăng nhập" : "Tạo tài khoản"}
      </button>
      <p className="text-center text-sm text-muted">
        {isLogin ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
        <Link
          href={`${isLogin ? "/dang-ky" : "/dang-nhap"}${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-semibold text-accent hover:underline"
        >
          {isLogin ? "Đăng ký" : "Đăng nhập"}
        </Link>
      </p>
    </form>
  );
}
