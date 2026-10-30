"use client";

import { Clapperboard, Film, History, House, Tv } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Trang chủ", icon: House, match: (p: string) => p === "/" },
  { href: "/danh-sach/phim-bo", label: "Phim bộ", icon: Tv, match: (p: string) => p.startsWith("/danh-sach/phim-bo") },
  { href: "/danh-sach/phim-le", label: "Phim lẻ", icon: Film, match: (p: string) => p.startsWith("/danh-sach/phim-le") },
  { href: "/danh-sach/hoat-hinh", label: "Hoạt hình", icon: Clapperboard, match: (p: string) => /hoat-hinh|anime/.test(p) },
  { href: "/tai-khoan/lich-su", label: "Lịch sử", icon: History, match: (p: string) => p.startsWith("/tai-khoan") },
];

/** Thanh điều hướng dưới cùng trên mobile. Dùng usePathname nên phải nằm trong <Suspense>. */
export function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return (
    <nav
      aria-label="Điều hướng nhanh"
      className="glass fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-2xl px-1 py-1.5 shadow-2xl shadow-black/60 md:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      {ITEMS.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[10px] font-medium transition-colors",
              active ? "text-accent" : "text-muted",
            )}
          >
            <Icon className={cn("size-5 transition-transform duration-300", active && "scale-110")} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
