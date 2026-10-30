import type { Metadata } from "next";
import { TakedownForm } from "@/components/takedown-form";
import { Container } from "@/components/ui";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Yêu cầu gỡ nội dung" };

export default function TakedownPage() {
  return (
    <Container className="max-w-2xl! py-10">
      <h1 className="text-2xl font-bold">Yêu cầu gỡ nội dung</h1>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
        <p>
          {SITE_NAME} không lưu trữ video. Trang chỉ hiển thị thông tin phim và nhúng trình phát từ các nguồn công khai trên
          internet.
        </p>
        <p>
          Nếu bạn là chủ sở hữu bản quyền (hoặc đại diện hợp pháp) và muốn gỡ nội dung, vui lòng gửi đường dẫn trang phim trên{" "}
          {SITE_NAME} cùng thông tin liên hệ. Nội dung sẽ được ẩn sau khi yêu cầu được xác minh.
        </p>
      </div>
      <TakedownForm />
    </Container>
  );
}
