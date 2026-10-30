"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState, type MouseEvent } from "react";

type Pair = readonly (readonly [string, string])[];

export function MobileNav({ nav, genres, countries }: { nav: Pair; genres: Pair; countries: Pair }) {
  const [open, setOpen] = useState(false);

  // Đóng menu khi bấm vào một link (không dùng usePathname để header vẫn prerender được)
  const closeOnLink = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  };

  return (
    <div className="xl:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Đóng menu" : "Mở menu"}
        className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open && (
        <div
          onClick={closeOnLink}
          className="glass animate-fade-in absolute inset-x-0 top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto rounded-b-3xl border-x-0 border-t-0 px-4 pb-6 pt-3 shadow-2xl shadow-black/60"
        >
          <nav aria-label="Danh mục" className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {nav.map(([href, label]) => (
              <Link key={href} href={href} className="rounded-xl bg-white/[0.06] px-3 py-2.5 text-sm font-medium ring-1 ring-white/10 transition-colors hover:bg-white/12">
                {label}
              </Link>
            ))}
          </nav>
          {(
            [
              ["Thể loại", "/the-loai", genres],
              ["Quốc gia", "/quoc-gia", countries],
            ] as const
          ).map(([title, base, items]) => (
            <section key={base} className="mt-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
              <div className="flex flex-wrap gap-1.5">
                {items.map(([slug, name]) => (
                  <Link key={slug} href={`${base}/${slug}`} className="rounded-full bg-white/[0.05] px-3 py-1 text-sm text-muted ring-1 ring-white/10 transition-colors hover:text-accent hover:ring-accent/40">
                    {name}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
