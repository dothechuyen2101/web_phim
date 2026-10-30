import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { setMovieHidden } from "@/app/actions/admin";
import { ActionButton, AdminSkeleton, AdminTitle, StatusPill, Table, Td } from "@/components/admin/ui";
import { Pagination } from "@/components/pagination";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { first, parsePage } from "@/lib/filters";
import { movieUrl, TYPE_LABELS } from "@/lib/site";
import { formatDateTime } from "@/lib/utils";
import { toSearchText } from "@/sources/normalize";

export const metadata: Metadata = { title: "Phim" };

const PAGE = 50;

export default function AdminMoviesPage(props: PageProps<"/admin/phim">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Movies {...props} />
    </Suspense>
  );
}

async function Movies({ searchParams }: PageProps<"/admin/phim">) {
  await requireAdmin();
  const params = await searchParams;
  const q = first(params.q)?.trim() ?? "";
  const hiddenOnly = first(params.an) === "1";
  const page = parsePage(params.trang);

  const and: Prisma.MovieWhereInput[] = [];
  if (hiddenOnly) and.push({ hidden: true });
  if (/^\d+$/.test(q)) and.push({ id: Number(q) });
  else for (const token of toSearchText(q).split(" ").filter(Boolean)) and.push({ searchText: { contains: token } });
  const where: Prisma.MovieWhereInput = { AND: and };

  const [total, movies] = await Promise.all([
    db.movie.count({ where }),
    db.movie.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        id: true, slug: true, name: true, originName: true, type: true, year: true, hidden: true, updatedAt: true,
        _count: { select: { sources: true, episodes: true } },
      },
    }),
  ]);

  return (
    <>
      <AdminTitle>Phim ({total.toLocaleString("vi-VN")})</AdminTitle>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Tên phim (không dấu được) hoặc ID" className="field max-w-sm" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="an" value="1" defaultChecked={hiddenOnly} className="accent-accent" /> Chỉ phim đang ẩn
        </label>
        <button className="btn btn-primary">Lọc</button>
      </form>
      <Table head={["ID", "Phim", "Loại", "Nguồn", "Tập", "Cập nhật", "Trạng thái", ""]}>
        {movies.map((movie) => (
          <tr key={movie.id}>
            <Td className="text-muted">{movie.id}</Td>
            <Td>
              <Link href={`/admin/phim/${movie.id}`} className="font-medium hover:text-accent">
                {movie.name}
              </Link>
              <p className="text-xs text-muted">
                {[movie.originName, movie.year].filter(Boolean).join(" · ")}
              </p>
            </Td>
            <Td>{TYPE_LABELS[movie.type]}</Td>
            <Td>{movie._count.sources}</Td>
            <Td>{movie._count.episodes}</Td>
            <Td className="whitespace-nowrap text-xs">{formatDateTime(movie.updatedAt)}</Td>
            <Td>{movie.hidden ? <StatusPill tone="error">Ẩn</StatusPill> : <StatusPill tone="ok">Hiện</StatusPill>}</Td>
            <Td className="whitespace-nowrap">
              <span className="flex gap-1.5">
                {!movie.hidden && (
                  <Link href={movieUrl(movie.slug)} className="btn btn-ghost px-2.5! py-1! text-xs!" target="_blank">
                    Xem
                  </Link>
                )}
                <ActionButton action={setMovieHidden.bind(null, movie.id, !movie.hidden)} tone={movie.hidden ? "ghost" : "danger"}>
                  {movie.hidden ? "Hiện lại" : "Ẩn"}
                </ActionButton>
              </span>
            </Td>
          </tr>
        ))}
      </Table>
      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / PAGE))}
        basePath="/admin/phim"
        params={{ q: q || undefined, an: hiddenOnly ? "1" : undefined }}
      />
    </>
  );
}
