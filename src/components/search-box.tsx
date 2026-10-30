"use client";

import { Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { movieUrl } from "@/lib/site";

interface Suggestion {
  slug: string;
  name: string;
  originName: string;
  posterUrl: string | null;
  year: number | null;
  episodeCurrent: string | null;
}

export function SearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const boxRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Gợi ý có debounce, hủy request cũ khi gõ tiếp
  const tooShort = query.trim().length < 2;
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/goi-y?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (res.ok) setItems(((await res.json()) as { items: Suggestion[] }).items);
      } catch {
        // bỏ qua lỗi mạng / request bị hủy
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const close = () => {
    setOpen(false);
    setExpanded(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setExpanded(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        aria-label="Tìm kiếm"
        className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg sm:hidden"
      >
        <Search className="size-5" />
      </button>
      <form
        ref={boxRef}
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          const q = query.trim();
          if (!q) return;
          close();
          router.push(`/tim-kiem?q=${encodeURIComponent(q)}`);
        }}
        className={
          expanded
            ? "absolute inset-x-0 top-0 z-50 flex h-14 items-center gap-2 bg-bg px-4 sm:static sm:h-auto sm:bg-transparent sm:p-0"
            : "relative hidden sm:block"
        }
      >
        <div className="relative w-full sm:w-60 2xl:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => event.key === "Escape" && close()}
            placeholder="Tìm phim, diễn viên…"
            aria-label="Tìm phim"
            className="field rounded-full! py-2! pl-9!"
          />
          {open && !tooShort && items.length > 0 && (
            <ul className="glass animate-scale-in absolute left-0 right-0 top-full z-50 mt-2 max-h-96 origin-top overflow-y-auto rounded-2xl p-1.5 shadow-2xl shadow-black/60">
              {items.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={movieUrl(item.slug)}
                    onClick={close}
                    className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/8"
                  >
                    <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-surface-2">
                      {item.posterUrl && <Image src={item.posterUrl} alt="" fill sizes="40px" className="object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="truncate text-xs text-muted">
                        {[item.originName, item.year, item.episodeCurrent].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        {expanded && (
          <button type="button" onClick={close} aria-label="Đóng tìm kiếm" className="grid size-9 shrink-0 place-items-center text-muted sm:hidden">
            <X className="size-5" />
          </button>
        )}
      </form>
    </>
  );
}
