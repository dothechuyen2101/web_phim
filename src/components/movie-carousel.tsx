"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Khung cuộn ngang có snap; nút trái/phải chỉ hiện khi còn chỗ để cuộn. */
export function MovieCarousel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure]);

  const scroll = (direction: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const arrow =
    "absolute top-[38%] z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full glass text-fg shadow-xl transition-all duration-300 hover:scale-110 hover:text-accent md:grid";
  return (
    <div className="group/row relative">
      <div
        ref={ref}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 pt-1.5 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0"
      >
        {children}
      </div>
      <button
        type="button"
        aria-label="Cuộn sang trái"
        onClick={() => scroll(-1)}
        className={cn(arrow, "-left-5", edges.start ? "pointer-events-none opacity-0" : "opacity-0 group-hover/row:opacity-100")}
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        aria-label="Cuộn sang phải"
        onClick={() => scroll(1)}
        className={cn(arrow, "-right-5", edges.end ? "pointer-events-none opacity-0" : "opacity-0 group-hover/row:opacity-100")}
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
