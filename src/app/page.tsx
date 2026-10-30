import { connection } from "next/server";
import { ContinueWatching } from "@/components/continue-watching";
import { HeroCarousel } from "@/components/hero-carousel";
import { MovieRow } from "@/components/movie-card";
import { Container, Reveal, SectionHeader, Skeleton } from "@/components/ui";
import { getHomeData, type MovieCardData } from "@/lib/queries";

export default function HomePage() {
  return (
    <Reveal fallback={<HomeSkeleton />}>
      <HomeContent />
    </Reveal>
  );
}

async function HomeContent() {
  // Không prerender lúc build (build không cần DB); dữ liệu vẫn được cache qua "use cache" trong getHomeData
  await connection();
  const data = await getHomeData();
  const sections: [string, string, MovieCardData[]][] = [
    ["Phim bộ mới", "/danh-sach/phim-bo", data.series],
    ["Phim lẻ mới", "/danh-sach/phim-le", data.singles],
    ["Hoạt hình", "/danh-sach/hoat-hinh", data.animation],
    ["Anime", "/danh-sach/anime", data.anime],
    ["Xem nhiều", "/danh-sach/phim-moi?sap-xep=xem-nhieu", data.popular],
  ];
  return (
    <>
      <HeroCarousel
        slides={data.featured.map((movie) => ({
          slug: movie.slug,
          name: movie.name,
          originName: movie.originName,
          image: movie.thumbUrl ?? movie.posterUrl,
          poster: movie.posterUrl,
          year: movie.year,
          quality: movie.quality,
          lang: movie.lang,
          episodeCurrent: movie.episodeCurrent,
          description: movie.description,
          genres: movie.genres,
        }))}
      />
      <Container className="relative pb-6">
        <ContinueWatching />
        {sections
          .filter(([, , movies]) => movies.length > 0)
          .map(([title, href, movies]) => (
            <section key={href} className="mt-10">
              <SectionHeader title={title} href={href} />
              <MovieRow movies={movies} />
            </section>
          ))}
      </Container>
    </>
  );
}

function HomeSkeleton() {
  return (
    <>
      <div className="relative -mt-14 h-[72svh] min-h-[480px] max-h-[760px]">
        <Skeleton className="absolute inset-0 rounded-none opacity-60" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl space-y-3 px-4 pb-14 sm:px-6">
          <Skeleton className="h-5 w-40 rounded-md" />
          <Skeleton className="h-12 w-2/3 max-w-xl rounded-lg" />
          <Skeleton className="h-4 w-1/2 max-w-md rounded-md" />
          <Skeleton className="h-11 w-36 rounded-full" />
        </div>
      </div>
      <Container className="mt-10">
        <Skeleton className="mb-4 h-6 w-40 rounded-md" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-[40%] shrink-0 sm:w-[28%] md:w-[22%] lg:w-[calc((100%-5*0.75rem)/6)]" />
          ))}
        </div>
      </Container>
    </>
  );
}
