"use client";

import { ChevronLeft, ChevronRight, Info, Play } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { SafeImage } from "@/components/safe-image";
import { Badge } from "@/components/ui";
import { movieUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

export interface HeroSlide {
  slug: string;
  name: string;
  originName: string;
  image: string | null;
  poster: string | null;
  year: number | null;
  quality: string | null;
  lang: string | null;
  episodeCurrent: string | null;
  description: string;
  genres: string[];
}

const SLIDE_MS = 7000;

function subscribeReducedMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);
  const autoplay = !paused && !reducedMotion && count > 1;

  if (count === 0) return null;
  const slide = slides[index];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Phim nổi bật"
      className="group/hero relative -mt-14 h-[72svh] min-h-[480px] max-h-[760px] overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(event) => (touchX.current = event.touches[0].clientX)}
      onTouchEnd={(event) => {
        if (touchX.current === null) return;
        const dx = event.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") go(index + 1);
        if (event.key === "ArrowLeft") go(index - 1);
      }}
    >
      {/* Ảnh nền: crossfade giữa các slide, slide đang hiện có hiệu ứng Ken Burns */}
      {slides.map((s, i) => (
        <div
          key={s.slug}
          aria-hidden={i !== index}
          className={cn(
            "absolute inset-0 transition-opacity duration-[1200ms] ease-out",
            i === index ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <div key={i === index ? `active-${index}` : "idle"} className={cn("absolute inset-0", i === index && "animate-ken-burns")}>
            <SafeImage src={s.image} alt="" sizes="100vw" priority={i === 0} label={s.name} />
          </div>
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-bg/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/40 to-transparent" />

      {/* Nội dung slide: key theo slide để chạy lại hiệu ứng xuất hiện */}
      <div className="absolute inset-x-0 bottom-0 pb-10 sm:pb-14">
        <div className="mx-auto flex w-full max-w-7xl items-end justify-between gap-8 px-4 sm:px-6">
          <div key={slide.slug} className="max-w-2xl">
            <div className="stagger mb-3 flex flex-wrap gap-1.5" style={{ "--i": 0 } as CSSProperties}>
              {slide.quality && <Badge className="bg-gradient-to-r from-accent to-accent-2 text-accent-fg">{slide.quality}</Badge>}
              {[slide.year, slide.episodeCurrent, slide.lang].filter(Boolean).map((value) => (
                <Badge key={String(value)} className="bg-white/12 text-fg">
                  {value}
                </Badge>
              ))}
            </div>
            <h2
              className="stagger text-3xl font-bold leading-tight tracking-tight drop-shadow-lg sm:text-5xl"
              style={{ "--i": 1 } as CSSProperties}
            >
              {slide.name}
            </h2>
            {slide.originName && (
              <p className="stagger mt-1.5 text-base text-muted sm:text-lg" style={{ "--i": 2 } as CSSProperties}>
                {slide.originName}
              </p>
            )}
            {slide.genres.length > 0 && (
              <p className="stagger mt-2 text-sm text-fg/80" style={{ "--i": 3 } as CSSProperties}>
                {slide.genres.join(" • ")}
              </p>
            )}
            {slide.description && (
              <p
                className="stagger mt-3 line-clamp-2 max-w-xl text-sm leading-relaxed text-fg/75 sm:line-clamp-3"
                style={{ "--i": 4 } as CSSProperties}
              >
                {slide.description}
              </p>
            )}
            <div className="stagger mt-5 flex flex-wrap gap-2.5" style={{ "--i": 5 } as CSSProperties}>
              <Link href={movieUrl(slide.slug)} className="btn btn-primary px-6!">
                <Play className="size-4 fill-current" /> Xem ngay
              </Link>
              <Link href={movieUrl(slide.slug)} className="btn btn-ghost">
                <Info className="size-4" /> Chi tiết
              </Link>
            </div>
          </div>

          {/* Dải thumbnail kèm thanh tiến trình (desktop) */}
          <div className="hidden shrink-0 gap-2.5 lg:flex">
            {slides.map((s, i) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => go(i)}
                aria-label={`Xem slide ${i + 1}: ${s.name}`}
                aria-current={i === index}
                className={cn(
                  "group relative h-28 w-20 overflow-hidden rounded-lg ring-1 transition-all duration-500 ease-[var(--ease-out-expo)]",
                  i === index ? "-translate-y-2 ring-accent shadow-xl shadow-accent/20" : "opacity-55 ring-white/10 hover:opacity-100",
                )}
              >
                <SafeImage src={s.poster ?? s.image} alt="" sizes="80px" />
                <span className="absolute inset-x-1.5 bottom-1.5 h-0.5 overflow-hidden rounded-full bg-white/25">
                  {i === index && (
                    <span
                      key={`p-${index}`}
                      className="block h-full origin-left rounded-full bg-accent"
                      style={{
                        animation: autoplay ? `progress ${SLIDE_MS}ms linear both` : "none",
                        transform: autoplay ? undefined : "scaleX(1)",
                      }}
                      onAnimationEnd={() => go(index + 1)}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chấm điều hướng (mobile) — thanh tiến trình cũng điều khiển chuyển slide */}
      <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 lg:hidden">
        {slides.map((s, i) => (
          <button
            key={s.slug}
            type="button"
            onClick={() => go(i)}
            aria-label={`Xem slide ${i + 1}`}
            className={cn("relative h-1.5 overflow-hidden rounded-full bg-white/25 transition-all duration-500", i === index ? "w-7" : "w-1.5")}
          >
            {i === index && (
              <span
                key={`m-${index}`}
                className="absolute inset-0 origin-left bg-accent"
                style={{ animation: autoplay ? `progress ${SLIDE_MS}ms linear both` : "none" }}
                // Animation không chạy trong phần tử display:none nên chỉ một trong hai thanh (mobile/desktop) chuyển slide
                onAnimationEnd={() => go(index + 1)}
              />
            )}
          </button>
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Slide trước"
            className="absolute left-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full glass opacity-0 transition-all hover:scale-110 hover:text-accent focus:opacity-100 md:grid group-hover/hero:opacity-100"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Slide sau"
            className="absolute right-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full glass opacity-0 transition-all hover:scale-110 hover:text-accent focus:opacity-100 md:grid group-hover/hero:opacity-100"
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      )}
    </section>
  );
}
