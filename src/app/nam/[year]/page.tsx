import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/ui";
import { ListSkeleton, MovieListView } from "@/components/movie-list-view";
import { parseFilters } from "@/lib/filters";
import { getFilterOptions, listMovies } from "@/lib/queries";

function parseYear(value: string) {
  const year = Number(value);
  return Number.isInteger(year) && year > 1900 && year < 2100 ? year : null;
}

export async function generateMetadata({ params }: PageProps<"/nam/[year]">): Promise<Metadata> {
  const year = parseYear((await params).year);
  return year ? { title: `Phim năm ${year}`, description: `Phim phát hành năm ${year} Vietsub, thuyết minh.` } : {};
}

export default function YearPage(props: PageProps<"/nam/[year]">) {
  return (
    <Reveal fallback={<ListSkeleton />}>
      <YearContent {...props} />
    </Reveal>
  );
}

async function YearContent({ params, searchParams }: PageProps<"/nam/[year]">) {
  const { year: rawYear } = await params;
  const year = parseYear(rawYear);
  if (!year) notFound();
  const { filters, page, raw } = parseFilters(await searchParams, { year });
  const [result, options] = await Promise.all([listMovies(filters, page), getFilterOptions()]);
  return (
    <MovieListView
      title={`Phim năm ${year}`}
      result={result}
      options={options}
      values={raw}
      hide={["nam"]}
      basePath={`/nam/${year}`}
    />
  );
}
