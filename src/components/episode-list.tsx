import Link from "next/link";
import type { CSSProperties } from "react";
import { watchUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

export function EpisodeList({
  slug,
  episodes,
  activeKey,
}: {
  slug: string;
  episodes: { key: string; name: string }[];
  activeKey?: string;
}) {
  return (
    <div className="grid max-h-[26rem] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
      {episodes.map((episode, i) => {
        const active = episode.key === activeKey;
        return (
          <Link
            key={episode.key}
            href={watchUrl(slug, episode.key)}
            aria-current={active ? "page" : undefined}
            style={{ "--i": Math.min(i, 24) } as CSSProperties}
            className={cn(
              "stagger truncate rounded-xl px-2 py-2.5 text-center text-sm font-medium transition-all duration-300",
              active
                ? "bg-gradient-to-r from-accent to-accent-2 text-accent-fg shadow-lg shadow-accent/25"
                : "bg-white/[0.05] ring-1 ring-white/[0.06] hover:-translate-y-0.5 hover:bg-white/10 hover:ring-accent/40",
            )}
            title={episode.name}
          >
            {episode.name}
          </Link>
        );
      })}
    </div>
  );
}
