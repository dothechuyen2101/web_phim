import { Calendar, Clock, Globe2, Tv } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import { EpisodeList } from "@/components/episode-list";
import { FavoriteButton } from "@/components/favorite-button";
import { FavoriteState } from "@/components/favorite-state";
import { MovieRow, Poster } from "@/components/movie-card";
import { RescueNotice } from "@/components/rescue-notice";
import { ResumeButton } from "@/components/resume-button";
import { SafeImage } from "@/components/safe-image";
import { Badge, Container, EmptyState, Reveal, SectionHeader, Skeleton } from "@/components/ui";
import { getMovie, getRelated, type MovieDetail } from "@/lib/queries";
import { SITE_URL, STATUS_LABELS, TYPE_LABELS, movieUrl } from "@/lib/site";

const excerpt = (text: string, max = 160) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
const delay = (i: number) => ({ "--i": i }) as CSSProperties;

export async function generateMetadata({ params }: PageProps<"/phim/[slug]">): Promise<Metadata> {
  const movie = await getMovie((await params).slug);
  if (!movie) return { title: "Không tìm thấy phim" };
  const title = `${movie.name}${movie.originName ? ` (${movie.originName})` : ""}${movie.year ? ` ${movie.year}` : ""}`;
  const image = movie.thumbUrl ?? movie.posterUrl;
  return {
    title,
    description: excerpt(movie.description || `Xem phim ${movie.name} ${movie.lang ?? ""} ${movie.quality ?? ""}`.trim()),
    alternates: { canonical: movieUrl(movie.slug) },
    openGraph: { title, type: "video.movie", url: movieUrl(movie.slug), images: image ? [image] : undefined },
  };
}

export default function MoviePage(props: PageProps<"/phim/[slug]">) {
  return (
    <Reveal fallback={<DetailSkeleton />}>
      <MovieDetailView params={props.params} />
    </Reveal>
  );
}

async function MovieDetailView({ params }: Pick<PageProps<"/phim/[slug]">, "params">) {
  const { slug } = await params;
  const movie = await getMovie(slug);
  if (!movie) notFound();
  const playable = movie.episodes.filter((e) => e.links.length > 0);
  const backdrop = movie.thumbUrl ?? movie.posterUrl;

  return (
    <>
      <JsonLd movie={movie} />
      <div className="relative">
        {/* Ảnh nền điện ảnh chạy dưới header */}
        <div className="absolute inset-x-0 -top-14 h-[30rem] overflow-hidden sm:h-[36rem]" aria-hidden>
          <div className="absolute inset-0 animate-ken-burns">
            <SafeImage src={backdrop} alt="" sizes="100vw" priority />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/75 to-bg" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg/90 via-bg/30 to-transparent" />
        </div>

        <Container className="relative pt-8 sm:pt-16">
          <div className="grid gap-6 sm:grid-cols-[13rem_1fr] md:grid-cols-[16rem_1fr] md:gap-10">
            <div className="animate-scale-in relative mx-auto aspect-[2/3] w-44 overflow-hidden rounded-2xl bg-surface-2 shadow-2xl shadow-black/70 ring-1 ring-white/10 sm:w-full">
              <Poster src={movie.posterUrl ?? movie.thumbUrl} alt={movie.name} sizes="(min-width:768px) 16rem, 13rem" priority />
            </div>
            <div className="min-w-0 sm:pt-4">
              <div className="stagger flex flex-wrap gap-1.5" style={delay(0)}>
                {movie.quality && <Badge className="bg-gradient-to-r from-accent to-accent-2 text-accent-fg">{movie.quality}</Badge>}
                {movie.lang && <Badge className="bg-white/12 text-fg">{movie.lang}</Badge>}
                <Badge className="bg-white/12 text-fg">{STATUS_LABELS[movie.status]}</Badge>
              </div>
              <h1 className="stagger mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl" style={delay(1)}>
                {movie.name}
              </h1>
              {movie.originName && (
                <p className="stagger mt-1.5 text-lg text-muted" style={delay(2)}>
                  {movie.originName}
                </p>
              )}
              <div className="stagger mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg/80" style={delay(3)}>
                {movie.year && <Meta icon={<Calendar className="size-4" />}>{movie.year}</Meta>}
                {movie.duration && <Meta icon={<Clock className="size-4" />}>{movie.duration}</Meta>}
                <Meta icon={<Tv className="size-4" />}>
                  {TYPE_LABELS[movie.type]}
                  {movie.episodeCurrent ? ` · ${movie.episodeCurrent}` : ""}
                  {movie.episodeTotal && movie.episodeTotal > 1 ? ` / ${movie.episodeTotal} tập` : ""}
                </Meta>
                {movie.countries.length > 0 && (
                  <Meta icon={<Globe2 className="size-4" />}>
                    {movie.countries.map((c, i) => (
                      <span key={c.slug}>
                        {i > 0 && ", "}
                        <Link href={`/quoc-gia/${c.slug}`} className="hover:text-accent">
                          {c.name}
                        </Link>
                      </span>
                    ))}
                  </Meta>
                )}
              </div>
              {movie.genres.length > 0 && (
                <div className="stagger mt-4 flex flex-wrap gap-2" style={delay(4)}>
                  {movie.genres.map((g) => (
                    <Link
                      key={g.slug}
                      href={`/the-loai/${g.slug}`}
                      className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-medium ring-1 ring-white/10 transition-all hover:bg-accent/15 hover:text-accent hover:ring-accent/40"
                    >
                      {g.name}
                    </Link>
                  ))}
                </div>
              )}
              <div className="stagger mt-6 flex flex-wrap gap-2.5" style={delay(5)}>
                {playable.length > 0 && (
                  <ResumeButton slug={movie.slug} firstKey={playable[0].key} keys={playable.map((e) => e.key)} />
                )}
                <Suspense fallback={<FavoriteButton movieId={movie.id} initial={false} loggedIn={false} />}>
                  <FavoriteState movieId={movie.id} />
                </Suspense>
              </div>
              {movie.description && (
                <p className="stagger mt-6 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-fg/75" style={delay(6)}>
                  {movie.description}
                </p>
              )}
              {(movie.directors.length > 0 || movie.actors.length > 0) && (
                <dl className="stagger mt-5 grid gap-1.5 text-sm" style={delay(7)}>
                  {movie.directors.length > 0 && <Info label="Đạo diễn">{movie.directors.join(", ")}</Info>}
                  {movie.actors.length > 0 && <Info label="Diễn viên">{movie.actors.slice(0, 10).join(", ")}</Info>}
                </dl>
              )}
            </div>
          </div>

          <section className="glass mt-10 rounded-2xl p-4 sm:p-5">
            <h2 className="mb-3 flex items-center justify-between font-bold">
              Danh sách tập
              {playable.length > 0 && <span className="text-xs font-normal text-muted">{playable.length} tập</span>}
            </h2>
            {playable.length > 0 ? (
              <EpisodeList slug={movie.slug} episodes={playable} />
            ) : movie.episodes.length > 0 ? (
              <RescueNotice movieId={movie.id} title="Tất cả server của phim đang lỗi" />
            ) : (
              <EmptyState title="Phim chưa có tập để xem">Phim sắp chiếu hoặc nguồn đang cập nhật, vui lòng quay lại sau.</EmptyState>
            )}
          </section>

          <Suspense>
            <Related movie={movie} />
          </Suspense>
        </Container>
      </div>
    </>
  );
}

async function Related({ movie }: { movie: MovieDetail }) {
  const related = await getRelated(movie.id, movie.type, movie.genres.map((g) => g.slug));
  if (related.length === 0) return null;
  return (
    <section className="mt-12">
      <SectionHeader title="Có thể bạn sẽ thích" />
      <MovieRow movies={related} />
    </section>
  );
}

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-accent" aria-hidden>
        {icon}
      </span>
      {children}
    </span>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-fg/85">{children}</dd>
    </div>
  );
}

function JsonLd({ movie }: { movie: MovieDetail }) {
  const data = {
    "@context": "https://schema.org",
    "@type": movie.type === "SINGLE" ? "Movie" : "TVSeries",
    name: movie.name,
    alternateName: movie.originName || undefined,
    description: excerpt(movie.description, 300) || undefined,
    image: movie.posterUrl ?? undefined,
    url: `${SITE_URL}${movieUrl(movie.slug)}`,
    datePublished: movie.year ? String(movie.year) : undefined,
    genre: movie.genres.map((g) => g.name),
    countryOfOrigin: movie.countries.map((c) => ({ "@type": "Country", name: c.name })),
    director: movie.directors.map((name) => ({ "@type": "Person", name })),
    actor: movie.actors.slice(0, 10).map((name) => ({ "@type": "Person", name })),
  };
  return (
    <script
      type="application/ld+json"
      // Escape "<" để nội dung từ nguồn không thể đóng thẻ script
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

function DetailSkeleton() {
  return (
    <Container className="pt-8 sm:pt-16">
      <div className="grid gap-6 sm:grid-cols-[13rem_1fr] md:grid-cols-[16rem_1fr] md:gap-10">
        <Skeleton className="mx-auto aspect-[2/3] w-44 rounded-2xl sm:w-full" />
        <div className="space-y-3 sm:pt-4">
          <Skeleton className="h-5 w-40 rounded-md" />
          <Skeleton className="h-11 w-2/3 rounded-lg" />
          <Skeleton className="h-5 w-1/3 rounded-md" />
          <Skeleton className="h-5 w-1/2 rounded-md" />
          <Skeleton className="h-11 w-44 rounded-full" />
          <Skeleton className="h-24 w-full max-w-3xl rounded-lg" />
        </div>
      </div>
    </Container>
  );
}
