import type { Metadata } from "next";
import { Suspense } from "react";
import { HistoryList } from "@/components/history-list";
import { Container, GridSkeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { episodeLabel } from "@/sources/normalize";

export const metadata: Metadata = { title: "Lịch sử xem", robots: { index: false } };

export default function HistoryPage() {
  return (
    <Container className="py-6">
      <h1 className="mb-6 text-2xl font-bold">Lịch sử xem</h1>
      <Suspense fallback={<GridSkeleton />}>
        <History />
      </Suspense>
    </Container>
  );
}

async function History() {
  const session = await requireUser("/tai-khoan/lich-su");
  const rows = await db.watchHistory.findMany({
    where: { userId: session.userId, movie: { hidden: false } },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      episodeKey: true,
      updatedAt: true,
      movie: { select: { id: true, slug: true, name: true, posterUrl: true, thumbUrl: true } },
    },
  });
  return (
    <HistoryList
      items={rows.map((row) => ({
        movieId: row.movie.id,
        slug: row.movie.slug,
        name: row.movie.name,
        posterUrl: row.movie.thumbUrl ?? row.movie.posterUrl,
        episodeKey: row.episodeKey,
        episodeName: episodeLabel(row.episodeKey, row.episodeKey),
        at: row.updatedAt.getTime(),
      }))}
    />
  );
}
