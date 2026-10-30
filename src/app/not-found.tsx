import Link from "next/link";
import { Container } from "@/components/ui";

export default function NotFound() {
  return (
    <Container className="py-24 text-center">
      <p className="text-6xl font-bold text-accent">404</p>
      <h1 className="mt-4 text-xl font-semibold">Không tìm thấy trang</h1>
      <p className="mt-2 text-sm text-muted">Phim có thể đã bị gỡ hoặc đường dẫn không đúng.</p>
      <Link href="/" className="btn btn-primary mt-6">
        Về trang chủ
      </Link>
    </Container>
  );
}
