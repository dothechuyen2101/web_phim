import type { Metadata } from "next";
import { Suspense } from "react";
import { MovieGrid } from "@/components/movie-card";
import { PushToggle } from "@/components/push-toggle";
import { Container, EmptyState, GridSkeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Phim yêu thích", robots: { index: false } };

export default function FavoritesPage() {
  return (
    <Container className="py-6">
      <h1 className="mb-6 text-2xl font-bold">Phim yêu thích</h1>
      <PushToggle />
      <Suspense fallback={<GridSkeleton />}>
        <Favorites />
      </Suspense>
    </Container>
  );
}

async function Favorites() {
  const session = await requireUser("/tai-khoan/yeu-thich");
  const favorites = await db.favorite.findMany({
    where: { userId: session.userId, movie: { hidden: false } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      createdAt: true,
      movie: {
        select: {
          id: true, slug: true, name: true, originName: true, posterUrl: true, thumbUrl: true,
          year: true, episodeCurrent: true, quality: true, lang: true, type: true,
        },
      },
    },
  });
  if (favorites.length === 0) {
    return <EmptyState title="Chưa có phim yêu thích">Bấm “Yêu thích” ở trang phim để lưu lại và được báo khi có tập mới.</EmptyState>;
  }

  // "Tập mới": có tập được thêm sau lần xem gần nhất (hoặc sau lúc bấm yêu thích nếu chưa xem)
  const movieIds = favorites.map((f) => f.movie.id);
  const [latest, history] = await Promise.all([
    db.episode.groupBy({ by: ["movieId"], where: { movieId: { in: movieIds } }, _max: { createdAt: true } }),
    db.watchHistory.findMany({ where: { userId: session.userId, movieId: { in: movieIds } }, select: { movieId: true, updatedAt: true } }),
  ]);
  const latestByMovie = new Map(latest.map((row) => [row.movieId, row._max.createdAt?.getTime() ?? 0]));
  const watchedByMovie = new Map(history.map((row) => [row.movieId, row.updatedAt.getTime()]));
  const flags = new Map<number, string>();
  for (const { movie, createdAt } of favorites) {
    const seen = Math.max(createdAt.getTime(), watchedByMovie.get(movie.id) ?? 0);
    if ((latestByMovie.get(movie.id) ?? 0) > seen) flags.set(movie.id, "Tập mới");
  }
  // Phim có tập mới lên đầu (tập mới nhất trước), còn lại giữ thứ tự bấm yêu thích
  const movies = favorites
    .map((f) => f.movie)
    .sort((a, b) => Number(flags.has(b.id)) - Number(flags.has(a.id)) || (flags.has(a.id) ? (latestByMovie.get(b.id) ?? 0) - (latestByMovie.get(a.id) ?? 0) : 0));
  return <MovieGrid movies={movies} flags={flags} />;
}
