import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Poster } from "@/components/movie-card";
import { Container, EmptyState, Reveal, Skeleton } from "@/components/ui";
import { first } from "@/lib/filters";
import { getNewEpisodes, type NewEpisodesGroup } from "@/lib/queries";
import { movieUrl, recentVnDays, watchUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

const DAYS = 7;
/** Số tập hiện trên mỗi thẻ; nhiều hơn thì ghi "+N tập". */
const SHOWN_EPISODES = 6;
const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const timeFormat = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });

export async function generateMetadata({ searchParams }: PageProps<"/tap-moi">): Promise<Metadata> {
  const day = first((await searchParams).ngay);
  return {
    title: "Tập mới hôm nay",
    description: "Phim bộ, hoạt hình, anime vừa ra tập mới hôm nay, Vietsub và thuyết minh, cập nhật liên tục trong ngày.",
    // Trang của các ngày trước chỉ để xem lại, không đưa lên Google
    ...(day ? { robots: { index: false, follow: true } } : { alternates: { canonical: "/tap-moi" } }),
  };
}

function dayLabel(day: string, index: number) {
  if (index === 0) return "Hôm nay";
  if (index === 1) return "Hôm qua";
  const [, month, date] = day.split("-");
  return `${WEEKDAYS[new Date(`${day}T12:00:00Z`).getUTCDay()]} ${date}/${month}`;
}

export default function NewEpisodesPage(props: PageProps<"/tap-moi">) {
  return (
    <Reveal fallback={<NewEpisodesSkeleton />}>
      <NewEpisodesContent {...props} />
    </Reveal>
  );
}

async function NewEpisodesContent({ searchParams }: PageProps<"/tap-moi">) {
  const requested = first((await searchParams).ngay);
  // "Hôm nay" tính theo giờ lúc request, không được chốt sẵn lúc prerender / prefetch
  await connection();
  const days = recentVnDays(DAYS);
  const index = Math.max(0, requested ? days.indexOf(requested) : 0);
  const groups = await getNewEpisodes(days[index]);
  const episodeCount = groups.reduce((sum, group) => sum + group.episodes.length, 0);

  return (
    <Container className="py-8">
      <h1 className="text-3xl font-bold tracking-tight">{index === 0 ? "Tập mới hôm nay" : `Tập mới ${dayLabel(days[index], index).toLowerCase()}`}</h1>
      <p className="mt-1 text-sm text-muted">
        <span className="font-semibold text-accent">{groups.length.toLocaleString("vi-VN")}</span> phim ·{" "}
        {episodeCount.toLocaleString("vi-VN")} tập mới · tự cập nhật trong ngày
      </p>

      <nav aria-label="Chọn ngày" className="-mx-1 my-6 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {days.map((day, i) => (
          <Link
            key={day}
            href={i === 0 ? "/tap-moi" : `/tap-moi?ngay=${day}`}
            aria-current={i === index ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ring-1 transition-colors",
              i === index ? "bg-accent text-accent-fg ring-accent" : "bg-white/[0.05] text-muted ring-white/10 hover:text-fg",
            )}
          >
            {dayLabel(day, i)}
          </Link>
        ))}
      </nav>

      {groups.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group, i) => (
            <NewEpisodesCard key={group.movie.id} group={group} priority={i < 6} />
          ))}
        </div>
      ) : (
        <EmptyState title="Chưa có tập mới" icon={<CalendarClock className="size-6" />}>
          {index === 0 ? "Hôm nay chưa có phim nào ra tập mới. Quay lại sau nhé!" : "Ngày này không có tập mới."}
        </EmptyState>
      )}
    </Container>
  );
}

function NewEpisodesCard({ group: { movie, episodes, latestAt }, priority }: { group: NewEpisodesGroup; priority: boolean }) {
  const shown = episodes.slice(-SHOWN_EPISODES);
  return (
    <article className="flex gap-3 rounded-2xl bg-surface/60 p-3 ring-1 ring-white/5 transition-colors hover:ring-accent/30">
      <Link href={movieUrl(movie.slug)} className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-lg bg-surface-2" tabIndex={-1}>
        <Poster src={movie.posterUrl ?? movie.thumbUrl} alt={movie.name} sizes="80px" priority={priority} />
      </Link>
      <div className="min-w-0 flex-1">
        <h2 className="line-clamp-1 font-semibold">
          <Link href={movieUrl(movie.slug)} className="transition-colors hover:text-accent">
            {movie.name}
          </Link>
        </h2>
        <p className="line-clamp-1 text-xs text-muted">{[movie.originName, movie.year].filter(Boolean).join(" · ")}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {episodes.length > shown.length && (
            <span className="rounded-full px-1 py-1 text-xs text-muted">+{episodes.length - shown.length} tập</span>
          )}
          {shown.map((episode) => (
            <Link
              key={episode.key}
              href={watchUrl(movie.slug, episode.key)}
              className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-medium ring-1 ring-white/10 transition-colors hover:text-accent hover:ring-accent/40"
            >
              {episode.name}
            </Link>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">Cập nhật lúc {timeFormat.format(latestAt)}</p>
      </div>
    </article>
  );
}

function NewEpisodesSkeleton() {
  return (
    <Container className="py-8">
      <Skeleton className="mb-2 h-9 w-64 rounded-lg" />
      <Skeleton className="mb-6 h-4 w-48 rounded-md" />
      <Skeleton className="mb-6 h-9 w-full max-w-xl rounded-full" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
    </Container>
  );
}
