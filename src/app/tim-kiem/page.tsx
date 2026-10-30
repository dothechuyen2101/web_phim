import type { Metadata } from "next";
import { MovieGrid } from "@/components/movie-card";
import { ListSkeleton } from "@/components/movie-list-view";
import { Pagination } from "@/components/pagination";
import { Container, EmptyState, Reveal } from "@/components/ui";
import { first, parsePage } from "@/lib/filters";
import { searchMovies } from "@/lib/queries";

export async function generateMetadata({ searchParams }: PageProps<"/tim-kiem">): Promise<Metadata> {
  const q = first((await searchParams).q)?.trim();
  return { title: q ? `Tìm kiếm: ${q}` : "Tìm kiếm", robots: { index: false } };
}

export default function SearchPage(props: PageProps<"/tim-kiem">) {
  return (
    <Reveal fallback={<ListSkeleton />}>
      <SearchContent {...props} />
    </Reveal>
  );
}

async function SearchContent({ searchParams }: PageProps<"/tim-kiem">) {
  const params = await searchParams;
  const q = first(params.q)?.trim().slice(0, 100) ?? "";
  const page = parsePage(params.trang);
  const result = q ? await searchMovies(q, page) : null;

  return (
    <Container className="py-6">
      <h1 className="text-2xl font-bold">{q ? <>Kết quả cho “{q}”</> : "Tìm kiếm phim"}</h1>
      {result && <p className="mb-6 mt-1 text-sm text-muted">{result.total.toLocaleString("vi-VN")} phim</p>}
      {!q ? (
        <form action="/tim-kiem" className="mt-6 flex max-w-xl gap-2">
          <input name="q" type="search" placeholder="Nhập tên phim (có dấu hoặc không dấu)" className="field" autoFocus />
          <button className="btn btn-primary">Tìm</button>
        </form>
      ) : result && result.items.length > 0 ? (
        <>
          <MovieGrid movies={result.items} />
          <Pagination page={result.page} totalPages={result.totalPages} basePath="/tim-kiem" params={{ q }} />
        </>
      ) : (
        <EmptyState title="Không tìm thấy phim nào">Thử từ khóa ngắn hơn, hoặc tên gốc (tiếng Anh) của phim.</EmptyState>
      )}
    </Container>
  );
}
