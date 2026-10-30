"use client";

import { Play, X } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { MovieCarousel } from "@/components/movie-carousel";
import { SafeImage } from "@/components/safe-image";
import { SectionHeader } from "@/components/ui";
import { removeLocalHistory, useLocalHistory } from "@/lib/local-history";
import { watchUrl } from "@/lib/site";

/** Hàng "Tiếp tục xem" trên trang chủ, đọc từ localStorage nên chỉ hiện sau khi trang đã chạy ở trình duyệt. */
export function ContinueWatching() {
  const items = useLocalHistory().slice(0, 12);
  if (items.length === 0) return null;
  return (
    <section className="mt-10 animate-fade-in">
      <SectionHeader title="Tiếp tục xem" href="/tai-khoan/lich-su" action="Lịch sử" />
      <MovieCarousel>
        {items.map((item, i) => (
          <div
            key={item.slug}
            className="group stagger relative w-[70%] shrink-0 snap-start sm:w-[45%] md:w-[31%] lg:w-[calc((100%-3*0.75rem)/4)]"
            style={{ "--i": i } as CSSProperties}
          >
            <Link href={watchUrl(item.slug, item.episodeKey)} className="block">
              <div className="relative aspect-video overflow-hidden rounded-xl bg-surface-2 ring-1 ring-white/5 transition-all duration-500 group-hover:-translate-y-1 group-hover:ring-accent/50">
                <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-110">
                  <SafeImage src={item.posterUrl} alt="" sizes="(min-width:1024px) 25vw, 70vw" label={item.name} className="object-top" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <span className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-accent/90 text-accent-fg shadow-lg shadow-accent/40 transition-transform duration-300 ease-[var(--ease-spring)] group-hover:scale-110">
                  <Play className="ml-0.5 size-5 fill-current" />
                </span>
                <div className="absolute inset-x-3 bottom-2.5">
                  <p className="line-clamp-1 text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-fg/70">Đang xem: {item.episodeName}</p>
                </div>
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-accent to-accent-2" />
              </div>
            </Link>
            <button
              type="button"
              onClick={() => removeLocalHistory(item.slug)}
              aria-label={`Xóa ${item.name} khỏi danh sách`}
              className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/70 text-muted opacity-0 transition-opacity hover:text-fg focus:opacity-100 group-hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </MovieCarousel>
    </section>
  );
}
