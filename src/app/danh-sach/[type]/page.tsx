import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/ui";
import { ListSkeleton, MovieListView } from "@/components/movie-list-view";
import { listPageSeo, parseFilters } from "@/lib/filters";
import { getFilterOptions, listMovies } from "@/lib/queries";
import { LIST_TYPES, type ListTypeSlug } from "@/lib/site";

const listType = (slug: string) => (slug in LIST_TYPES ? LIST_TYPES[slug as ListTypeSlug] : null);

export async function generateMetadata({ params, searchParams }: PageProps<"/danh-sach/[type]">): Promise<Metadata> {
  const { type } = await params;
  const def = listType(type);
  if (!def) return {};
  return {
    title: def.title,
    description: `Danh sách ${def.title.toLowerCase()} Vietsub, thuyết minh mới nhất.`,
    ...listPageSeo(`/danh-sach/${type}`, await searchParams),
  };
}

export default function ListPage(props: PageProps<"/danh-sach/[type]">) {
  return (
    <Reveal fallback={<ListSkeleton />}>
      <ListContent {...props} />
    </Reveal>
  );
}

async function ListContent({ params, searchParams }: PageProps<"/danh-sach/[type]">) {
  const { type } = await params;
  const def = listType(type);
  if (!def) notFound();
  const { filters, page, raw } = parseFilters(await searchParams, { type: def.type, anime: def.anime || undefined });
  const [result, options] = await Promise.all([listMovies(filters, page), getFilterOptions()]);
  return (
    <MovieListView
      title={def.title}
      result={result}
      options={options}
      values={raw}
      hide={def.type ? ["loai"] : []}
      basePath={`/danh-sach/${type}`}
    />
  );
}
