import type { Metadata } from "next";
import { Suspense } from "react";
import { MovieGrid } from "@/components/movie-card";
import { Container, EmptyState, GridSkeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Phim yêu thích", robots: { index: false } };

export default function FavoritesPage() {
  return (
    <Container className="py-6">
      <h1 className="mb-6 text-2xl font-bold">Phim yêu thích</h1>
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
      movie: {
        select: {
          id: true, slug: true, name: true, originName: true, posterUrl: true, thumbUrl: true,
          year: true, episodeCurrent: true, quality: true, lang: true, type: true,
        },
      },
    },
  });
  if (favorites.length === 0) {
    return <EmptyState title="Chưa có phim yêu thích">Bấm “Yêu thích” ở trang phim để lưu lại.</EmptyState>;
  }
  return <MovieGrid movies={favorites.map((f) => f.movie)} />;
}
