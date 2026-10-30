"use client";

import { Container } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container className="py-24 text-center">
      <h1 className="text-xl font-semibold">Đã có lỗi xảy ra</h1>
      <p className="mt-2 text-sm text-muted">Vui lòng thử lại sau ít phút.</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-6">
        Thử lại
      </button>
    </Container>
  );
}
