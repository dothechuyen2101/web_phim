import { Clapperboard } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui";
import { NAV_GENRES, SITE_NAME } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="relative mt-20 pb-8 pt-10 text-sm text-muted">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" aria-hidden />
      <Container className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-base font-bold text-fg">
            <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-2 text-accent-fg">
              <Clapperboard className="size-4" aria-hidden />
            </span>
            {SITE_NAME}
          </p>
          <p className="max-w-md leading-relaxed">
            {SITE_NAME} không lưu trữ video trên máy chủ. Thông tin phim và trình phát được tổng hợp tự động từ các nguồn công
            khai trên internet.
          </p>
        </div>
        <nav aria-label="Thể loại nổi bật" className="grid grid-cols-2 content-start gap-x-4 gap-y-1.5">
          {NAV_GENRES.slice(0, 8).map(([slug, name]) => (
            <Link key={slug} href={`/the-loai/${slug}`} className="transition-colors hover:text-accent">
              {name}
            </Link>
          ))}
        </nav>
        <nav aria-label="Liên kết" className="flex flex-col gap-1.5">
          <Link href="/danh-sach/phim-moi" className="transition-colors hover:text-accent">
            Phim mới cập nhật
          </Link>
          <Link href="/tim-kiem" className="transition-colors hover:text-accent">
            Tìm kiếm
          </Link>
          <Link href="/gui-yeu-cau-go" className="transition-colors hover:text-accent">
            Yêu cầu gỡ nội dung
          </Link>
        </nav>
      </Container>
    </footer>
  );
}
