import { FavoriteButton } from "@/components/favorite-button";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

/** Đọc phiên đăng nhập nên luôn nằm trong <Suspense>. */
export async function FavoriteState({ movieId }: { movieId: number }) {
  const session = await getSession();
  const favorited = session
    ? !!(await db.favorite.findUnique({ where: { userId_movieId: { userId: session.userId, movieId } }, select: { movieId: true } }))
    : false;
  return <FavoriteButton movieId={movieId} initial={favorited} loggedIn={!!session} />;
}
