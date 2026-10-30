import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Phân trang qua tham số ?trang=, giữ nguyên các tham số lọc khác. */
export function Pagination({
  page,
  totalPages,
  basePath,
  params,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;
  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value && key !== "trang") search.set(key, value);
    if (target > 1) search.set("trang", String(target));
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const pages = new Set([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
  const visible = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const cell = "grid h-10 min-w-10 place-items-center rounded-full px-3 text-sm font-medium transition-all duration-300";

  return (
    <nav aria-label="Phân trang" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link href={href(page - 1)} className={cn(cell, "bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/12 hover:ring-accent/40")} aria-label="Trang trước">
          <ChevronLeft className="size-4" />
        </Link>
      )}
      {visible.map((p, i) => (
        <span key={p} className="contents">
          {i > 0 && p - visible[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
          <Link
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(cell, p === page ? "bg-gradient-to-r from-accent to-accent-2 font-bold text-accent-fg shadow-lg shadow-accent/25" : "bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/12 hover:ring-accent/40")}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < totalPages && (
        <Link href={href(page + 1)} className={cn(cell, "bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/12 hover:ring-accent/40")} aria-label="Trang sau">
          <ChevronRight className="size-4" />
        </Link>
      )}
    </nav>
  );
}
