import { SearchX } from "lucide-react";
import { FilterBar } from "@/components/filter-bar";
import { MovieGrid } from "@/components/movie-card";
import { Pagination } from "@/components/pagination";
import { Container, EmptyState, GridSkeleton, Skeleton } from "@/components/ui";
import type { FilterKey } from "@/lib/filters";
import type { getFilterOptions, MoviePage } from "@/lib/queries";

/** Khung chung cho mọi trang danh sách: tiêu đề, bộ lọc, lưới phim, phân trang. */
export function MovieListView({
  title,
  description,
  result,
  options,
  values,
  hide,
  basePath,
}: {
  title: string;
  description?: string;
  result: MoviePage;
  options: Awaited<ReturnType<typeof getFilterOptions>>;
  values: Record<string, string | undefined>;
  hide?: FilterKey[];
  basePath: string;
}) {
  return (
    <Container className="py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">
            {description ?? (
              <>
                <span className="font-semibold text-accent">{result.total.toLocaleString("vi-VN")}</span> phim
                {result.totalPages > 1 && ` · trang ${result.page}/${result.totalPages}`}
              </>
            )}
          </p>
        </div>
      </div>
      <FilterBar options={options} values={values} hide={hide} />
      {result.items.length > 0 ? (
        <>
          <MovieGrid movies={result.items} />
          <Pagination page={result.page} totalPages={result.totalPages} basePath={basePath} params={values} />
        </>
      ) : (
        <EmptyState title="Không có phim phù hợp" icon={<SearchX className="size-6" />}>
          Thử bỏ bớt điều kiện lọc.
        </EmptyState>
      )}
    </Container>
  );
}

export function ListSkeleton() {
  return (
    <Container className="py-8">
      <Skeleton className="mb-2 h-9 w-56 rounded-lg" />
      <Skeleton className="mb-6 h-4 w-32 rounded-md" />
      <Skeleton className="mb-6 h-14 rounded-2xl" />
      <GridSkeleton />
    </Container>
  );
}
