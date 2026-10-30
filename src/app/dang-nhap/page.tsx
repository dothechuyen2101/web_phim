import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "Đăng nhập", robots: { index: false } };

export default function LoginPage() {
  return (
    <Container className="max-w-md! py-12">
      <h1 className="mb-1 text-2xl font-bold">Đăng nhập</h1>
      <p className="mb-6 text-sm text-muted">Lưu phim yêu thích và đồng bộ lịch sử xem giữa các thiết bị.</p>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </Container>
  );
}
