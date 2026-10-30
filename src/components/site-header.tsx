import { ChevronDown, Clapperboard } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { HeaderShell } from "@/components/header-shell";
import { MobileNav } from "@/components/mobile-nav";
import { SearchBox } from "@/components/search-box";
import { Container } from "@/components/ui";
import { UserMenu } from "@/components/user-menu";
import { NAV_COUNTRIES, NAV_GENRES, SITE_NAME } from "@/lib/site";

export const MAIN_NAV = [
  ["/danh-sach/phim-moi", "Phim mới"],
  ["/danh-sach/phim-bo", "Phim bộ"],
  ["/danh-sach/phim-le", "Phim lẻ"],
  ["/danh-sach/hoat-hinh", "Hoạt hình"],
  ["/danh-sach/anime", "Anime"],
  ["/danh-sach/tv-shows", "TV Shows"],
] as const;

const navLink =
  "relative whitespace-nowrap rounded-md px-2.5 py-2 text-fg/75 transition-colors hover:text-fg after:absolute after:inset-x-2.5 after:bottom-1 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-gradient-to-r after:from-accent after:to-accent-2 after:transition-transform after:duration-300 hover:after:scale-x-100";

function NavDropdown({ label, base, items }: { label: string; base: string; items: readonly (readonly [string, string])[] }) {
  return (
    <div className="group relative">
      <button type="button" className={`${navLink} flex items-center gap-1 group-focus-within:text-fg`}>
        {label} <ChevronDown className="size-3.5 transition-transform duration-300 group-hover:rotate-180" aria-hidden />
      </button>
      <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-all duration-300 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        <div className="glass grid w-[30rem] translate-y-1 grid-cols-3 gap-0.5 rounded-2xl p-2 shadow-2xl shadow-black/50 transition-transform duration-300 group-hover:translate-y-0">
          {items.map(([slug, name]) => (
            <Link key={slug} href={`${base}/${slug}`} className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-white/8 hover:text-fg">
              {name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SiteHeader() {
  return (
    <HeaderShell>
      <Container className="flex h-14 items-center gap-3">
        <Link href="/" className="group flex shrink-0 items-center gap-2 font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-2 text-accent-fg shadow-lg shadow-accent/30 transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-105">
            <Clapperboard className="size-[18px]" aria-hidden />
          </span>
          <span className="text-lg tracking-tight">{SITE_NAME}</span>
        </Link>
        <nav aria-label="Danh mục" className="ml-2 hidden items-center text-sm xl:flex">
          {MAIN_NAV.map(([href, label]) => (
            <Link key={href} href={href} className={navLink}>
              {label}
            </Link>
          ))}
          <NavDropdown label="Thể loại" base="/the-loai" items={NAV_GENRES} />
          <NavDropdown label="Quốc gia" base="/quoc-gia" items={NAV_COUNTRIES} />
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <SearchBox />
          <Suspense fallback={<div className="size-9" />}>
            <UserMenu />
          </Suspense>
          <MobileNav nav={MAIN_NAV} genres={NAV_GENRES} countries={NAV_COUNTRIES} />
        </div>
      </Container>
    </HeaderShell>
  );
}
