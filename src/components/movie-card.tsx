import { Play } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { MovieCarousel } from "@/components/movie-carousel";
import { SafeImage } from "@/components/safe-image";
import { Badge } from "@/components/ui";
import type { MovieCardData } from "@/lib/queries";
import { movieUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Poster({
  src,
  alt,
  sizes,
  priority,
  className,
}: {
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return <SafeImage src={src} alt={alt} sizes={sizes} priority={priority} label={alt} className={className} />;
}

export function MovieCard({
  movie,
  priority,
  className,
  index = 0,
  flag,
}: {
  movie: MovieCardData;
  priority?: boolean;
  className?: string;
  /** thứ tự để các thẻ hiện ra lần lượt */
  index?: number;
  /** nhãn nổi bật ở góc dưới, ví dụ "Tập mới" */
  flag?: string;
}) {
  return (
    <Link
      href={movieUrl(movie.slug)}
      className={cn("group stagger block outline-none", className)}
      style={{ "--i": index } as CSSProperties}
      title={movie.name}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface-2 ring-1 ring-white/5 transition-all duration-500 ease-[var(--ease-out-expo)] group-hover:-translate-y-1.5 group-hover:shadow-2xl group-hover:shadow-accent/15 group-hover:ring-accent/50 group-focus-visible:ring-2 group-focus-visible:ring-accent">
        <div className="absolute inset-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-110">
          <Poster
            src={movie.posterUrl ?? movie.thumbUrl}
            alt={movie.name}
            sizes="(min-width:1024px) 16vw, (min-width:640px) 25vw, 45vw"
            priority={priority}
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute inset-x-0 top-0 flex justify-between gap-1 p-2">
          {movie.episodeCurrent && <Badge className="max-w-[70%] truncate bg-black/60 text-fg">{movie.episodeCurrent}</Badge>}
          {movie.quality && <Badge className="bg-gradient-to-r from-accent to-accent-2 text-accent-fg">{movie.quality}</Badge>}
        </div>
        <span className="absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 scale-50 place-items-center rounded-full bg-accent/90 text-accent-fg opacity-0 shadow-lg shadow-accent/40 transition-all duration-300 ease-[var(--ease-spring)] group-hover:scale-100 group-hover:opacity-100">
          <Play className="ml-0.5 size-5 fill-current" aria-hidden />
        </span>
        {movie.lang && <Badge className="absolute bottom-2 left-2 bg-black/60 text-muted">{movie.lang}</Badge>}
        {flag && <Badge className="absolute bottom-2 right-2 bg-gradient-to-r from-accent to-accent-2 text-accent-fg shadow-lg shadow-accent/30">{flag}</Badge>}
      </div>
      <h3 className="mt-2.5 line-clamp-1 text-sm font-semibold transition-colors group-hover:text-accent">{movie.name}</h3>
      <p className="line-clamp-1 text-xs text-muted">{[movie.originName, movie.year].filter(Boolean).join(" · ")}</p>
    </Link>
  );
}

export function MovieGrid({ movies, flags }: { movies: MovieCardData[]; flags?: Map<number, string> }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {movies.map((movie, i) => (
        <MovieCard key={movie.id} movie={movie} priority={i < 6} index={i} flag={flags?.get(movie.id)} />
      ))}
    </div>
  );
}

/** Hàng phim cuộn ngang có nút mũi tên (desktop) và vuốt (mobile). */
export function MovieRow({ movies }: { movies: MovieCardData[] }) {
  return (
    <MovieCarousel>
      {movies.map((movie, i) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          index={i}
          className="w-[40%] shrink-0 snap-start sm:w-[28%] md:w-[22%] lg:w-[calc((100%-5*0.75rem)/6)]"
        />
      ))}
    </MovieCarousel>
  );
}
