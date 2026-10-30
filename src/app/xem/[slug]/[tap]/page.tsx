import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import { EpisodeList } from "@/components/episode-list";
import { Player, type PlayerServer } from "@/components/player";
import { RescueNotice } from "@/components/rescue-notice";
import { SafeImage } from "@/components/safe-image";
import { Container, Reveal, Skeleton } from "@/components/ui";
import { getMovie } from "@/lib/queries";
import { episodeKeyFromParam, movieUrl, watchUrl } from "@/lib/site";

async function load(params: PageProps<"/xem/[slug]/[tap]">["params"]) {
  const { slug, tap } = await params;
  const movie = await getMovie(slug);
  if (!movie) return null;
  const key = episodeKeyFromParam(tap);
  const episode = movie.episodes.find((e) => e.key === key);
  if (!episode) return null;
  const playable = movie.episodes.filter((e) => e.links.length > 0);
  return { movie, playable, episode, index: playable.findIndex((e) => e.key === key) };
}

export async function generateMetadata({ params }: PageProps<"/xem/[slug]/[tap]">): Promise<Metadata> {
  const data = await load(params);
  if (!data) return { title: "Không tìm thấy tập phim" };
  const { movie, episode } = data;
  return {
    title: `Xem ${movie.name} – ${episode.name}`,
    description: `Xem ${movie.name} ${episode.name} ${movie.lang ?? ""} ${movie.quality ?? ""}`.trim(),
    alternates: { canonical: watchUrl(movie.slug, episode.key) },
    openGraph: { images: movie.thumbUrl ? [movie.thumbUrl] : undefined },
  };
}

export default function WatchPage(props: PageProps<"/xem/[slug]/[tap]">) {
  return (
    <Reveal fallback={<WatchSkeleton />}>
      <WatchView params={props.params} />
    </Reveal>
  );
}

async function WatchView({ params }: Pick<PageProps<"/xem/[slug]/[tap]">, "params">) {
  const data = await load(params);
  if (!data) notFound();
  const { movie, playable, episode, index } = data;
  const prev = index > 0 ? playable[index - 1] : undefined;
  const next = index >= 0 ? playable[index + 1] : undefined;
  // Mỗi link: player nhúng của nguồn, kèm ngay sau là bản dự phòng phát thẳng luồng m3u8 gốc (nếu nguồn có)
  const servers: PlayerServer[] = episode.links.flatMap((link) => {
    const label = `${link.source.name} · ${link.serverName}`;
    const embed: PlayerServer = { linkId: link.id, kind: "embed", label, url: link.embedUrl };
    return link.streamUrl ? [embed, { linkId: link.id, kind: "hls", label: `${label} · Dự phòng`, url: link.streamUrl }] : [embed];
  });
  const image = movie.thumbUrl ?? movie.posterUrl;

  return (
    <div className="relative">
      {/* Quầng sáng "ambient" lấy từ ảnh phim phía sau player */}
      <div className="pointer-events-none absolute inset-x-0 -top-14 h-[70vh] overflow-hidden opacity-45" aria-hidden>
        <div className="absolute inset-0 scale-125 blur-3xl saturate-150">
          <SafeImage src={image} alt="" sizes="50vw" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-bg/30 via-bg/70 to-bg" />
      </div>

      <Container className="relative py-5">
        <nav aria-label="Đường dẫn" className="mb-4 flex min-w-0 items-center gap-2 text-sm text-muted">
          <Link href="/" className="shrink-0 transition-colors hover:text-fg">Trang chủ</Link>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden />
          <Link href={movieUrl(movie.slug)} className="truncate transition-colors hover:text-fg">{movie.name}</Link>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden />
          <span className="shrink-0 text-fg">{episode.name}</span>
        </nav>

        {/* Mỗi tập là một "cảnh": bấm tập trước / sau thì trượt theo hướng tương ứng */}
        <ViewTransition
          key={episode.key}
          enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
          exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
          default="none"
        >
          <div>
            {servers.length > 0 ? (
              <Player
                servers={servers}
                movie={{ id: movie.id, slug: movie.slug, name: movie.name, imageUrl: image }}
                episode={{ key: episode.key, name: episode.name }}
              />
            ) : (
              <RescueNotice movieId={movie.id} title={`${episode.name} tạm thời không xem được`} />
            )}
          </div>
        </ViewTransition>

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              {movie.name} <span className="text-gradient">– {episode.name}</span>
            </h1>
            {movie.originName && <p className="mt-0.5 text-sm text-muted">{movie.originName}</p>}
          </div>
          <div className="flex gap-2">
            {prev && (
              <Link href={watchUrl(movie.slug, prev.key)} transitionTypes={["nav-back"]} className="btn btn-ghost">
                <ChevronLeft className="size-4" /> Tập trước
              </Link>
            )}
            {next && (
              <Link href={watchUrl(movie.slug, next.key)} transitionTypes={["nav-forward"]} className="btn btn-primary">
                Tập tiếp <ChevronRight className="size-4" />
              </Link>
            )}
          </div>
        </div>

        {playable.length > 1 && (
          <section className="glass mt-6 rounded-2xl p-4 sm:p-5">
            <h2 className="mb-3 font-bold">Danh sách tập</h2>
            <EpisodeList slug={movie.slug} episodes={playable} activeKey={episode.key} />
          </section>
        )}
      </Container>
    </div>
  );
}

function WatchSkeleton() {
  return (
    <Container className="py-5">
      <Skeleton className="mb-4 h-5 w-64 rounded-md" />
      <Skeleton className="aspect-video w-full rounded-2xl" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-8 w-36 rounded-full" />
        <Skeleton className="h-8 w-36 rounded-full" />
      </div>
      <Skeleton className="mt-6 h-8 w-1/2 rounded-lg" />
    </Container>
  );
}
