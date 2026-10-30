import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: { default: "Quản trị", template: "%s | Quản trị" }, robots: { index: false } };

const NAV = [
  ["/admin", "Tổng quan"],
  ["/admin/nguon", "Nguồn & đồng bộ"],
  ["/admin/phim", "Phim"],
  ["/admin/bao-loi", "Báo lỗi"],
  ["/admin/yeu-cau-go", "Yêu cầu gỡ"],
] as const;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Container className="py-6">
      <nav aria-label="Quản trị" className="scrollbar-none mb-6 flex gap-1 overflow-x-auto border-b border-line pb-3">
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-fg">
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </Container>
  );
}
