import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { checkMovieLinks, rescueNow, resyncMovie, setLinkBroken, setMovieHidden } from "@/app/actions/admin";
import { MovieEditForm } from "@/components/admin/movie-edit-form";
import { ActionButton, AdminSkeleton, AdminTitle, Card, StatusPill, Table, Td } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { movieUrl } from "@/lib/site";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Sửa phim" };

export default function AdminMoviePage(props: PageProps<"/admin/phim/[id]">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <MovieAdmin params={props.params} />
    </Suspense>
  );
}

async function MovieAdmin({ params }: Pick<PageProps<"/admin/phim/[id]">, "params">) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const movie = await db.movie.findUnique({
    where: { id },
    include: {
      sources: { include: { source: { select: { name: true, key: true } } } },
      episodes: {
        orderBy: { sortOrder: "asc" },
        include: { links: { include: { source: { select: { name: true } } }, orderBy: { serverName: "asc" } } },
      },
    },
  });
  if (!movie) notFound();

  return (
    <>
      <AdminTitle
        aside={
          <div className="flex flex-wrap gap-2">
            {!movie.hidden && (
              <Link href={movieUrl(movie.slug)} target="_blank" className="btn btn-ghost px-2.5! py-1! text-xs!">
                Mở trang phim
              </Link>
            )}
            <ActionButton action={resyncMovie.bind(null, movie.id)}>Crawl lại từ các nguồn</ActionButton>
            <ActionButton action={checkMovieLinks.bind(null, movie.id)}>Kiểm tra link</ActionButton>
            <ActionButton action={rescueNow.bind(null, movie.id)}>Tìm nguồn thay thế</ActionButton>
            <ActionButton action={setMovieHidden.bind(null, movie.id, !movie.hidden)} tone={movie.hidden ? "primary" : "danger"}>
              {movie.hidden ? "Hiện lại" : "Ẩn phim"}
            </ActionButton>
          </div>
        }
      >
        {movie.name} {movie.hidden && <StatusPill tone="error">Đang ẩn</StatusPill>}
      </AdminTitle>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <MovieEditForm movie={movie} />
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">Nguồn</h2>
          <ul className="space-y-2 text-sm">
            {movie.sources.map((s) => (
              <li key={s.id}>
                <span className="font-medium">{s.source.name}</span>{" "}
                <code className="text-xs text-muted">{s.externalSlug}</code>
                <p className="text-xs text-muted">Cập nhật ở nguồn: {formatDateTime(s.lastModified)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 text-xs text-muted">
            <div>Slug: <code>{movie.slug}</code></div>
            <div>TMDB: <code>{movie.tmdbKey ?? "—"}</code></div>
            <div>IMDb: <code>{movie.imdbId ?? "—"}</code></div>
            <div>Lượt xem: {movie.viewCount.toLocaleString("vi-VN")}</div>
          </dl>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold">Tập & link ({movie.episodes.length} tập)</h2>
      <Table head={["Tập", "Server", "Link nhúng", "Trạng thái", "Kiểm tra m3u8", ""]}>
        {movie.episodes.flatMap((episode) =>
          episode.links.map((link, i) => (
            <tr key={link.id}>
              <Td className="whitespace-nowrap font-medium">{i === 0 ? episode.name : ""}</Td>
              <Td className="whitespace-nowrap">{link.source.name} · {link.serverName}</Td>
              <Td className="max-w-md truncate text-xs text-muted">
                <a href={link.embedUrl} target="_blank" rel="noreferrer" className="hover:text-fg">
                  {link.embedUrl}
                </a>
              </Td>
              <Td>{link.broken ? <StatusPill tone="error">Hỏng</StatusPill> : <StatusPill tone="ok">OK</StatusPill>}</Td>
              <Td className="whitespace-nowrap text-xs text-muted">
                {!link.streamUrl
                  ? "không có m3u8"
                  : link.checkedAt
                    ? `${formatDateTime(link.checkedAt)}${link.failCount ? ` · lỗi ${link.failCount} lần` : ""}`
                    : "chưa kiểm tra"}
              </Td>
              <Td>
                <ActionButton action={setLinkBroken.bind(null, link.id, !link.broken)} tone={link.broken ? "ghost" : "danger"}>
                  {link.broken ? "Bật lại" : "Đánh dấu hỏng"}
                </ActionButton>
              </Td>
            </tr>
          )),
        )}
      </Table>
    </>
  );
}
