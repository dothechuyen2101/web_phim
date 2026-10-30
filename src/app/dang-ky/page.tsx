import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "Đăng ký", robots: { index: false } };

export default function RegisterPage() {
  return (
    <Container className="max-w-md! py-12">
      <h1 className="mb-1 text-2xl font-bold">Tạo tài khoản</h1>
      <p className="mb-6 text-sm text-muted">Miễn phí, chỉ cần email và mật khẩu.</p>
      <Suspense>
        <AuthForm mode="register" />
      </Suspense>
    </Container>
  );
}
