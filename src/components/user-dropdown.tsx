"use client";

import { Heart, History, LogOut, Shield } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions/auth";

export function UserDropdown({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const item = "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-white/8";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Tài khoản"
        className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-sm font-bold uppercase text-accent-fg shadow-lg shadow-accent/30 transition-transform duration-300 hover:scale-105"
      >
        {name.trim().charAt(0) || "?"}
      </button>
      {open && (
        <div
          className="glass animate-scale-in absolute right-0 top-full z-50 mt-2 w-56 origin-top-right rounded-2xl p-1.5 shadow-2xl shadow-black/60"
          // Chỉ đóng khi bấm link: đóng ngay khi bấm nút "Đăng xuất" sẽ gỡ <form> trước khi trình duyệt kịp gửi
          onClick={(event) => (event.target as HTMLElement).closest("a") && setOpen(false)}
        >
          <p className="truncate px-3 py-2 text-sm font-semibold">{name}</p>
          <Link href="/tai-khoan/yeu-thich" className={item}>
            <Heart className="size-4 text-muted" /> Phim yêu thích
          </Link>
          <Link href="/tai-khoan/lich-su" className={item}>
            <History className="size-4 text-muted" /> Lịch sử xem
          </Link>
          {isAdmin && (
            <Link href="/admin" className={item}>
              <Shield className="size-4 text-muted" /> Quản trị
            </Link>
          )}
          <form action={logout}>
            <button type="submit" className={`${item} w-full text-danger`}>
              <LogOut className="size-4" /> Đăng xuất
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
