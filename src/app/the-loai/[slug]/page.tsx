import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/ui";
import { ListSkeleton, MovieListView } from "@/components/movie-list-view";
import { parseFilters } from "@/lib/filters";
import { getFilterOptions, listMovies } from "@/lib/queries";

async function findGenre(slug: string) {
  return (await getFilterOptions()).genres.find((g) => g.slug === slug) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/the-loai/[slug]">): Promise<Metadata> {
  const genre = await findGenre((await params).slug);
  return genre ? { title: `Phim ${genre.name}`, description: `Tuyển tập phim ${genre.name} Vietsub, thuyết minh mới nhất.` } : {};
}

export default function GenrePage(props: PageProps<"/the-loai/[slug]">) {
  return (
    <Reveal fallback={<ListSkeleton />}>
      <GenreContent {...props} />
    </Reveal>
  );
}

async function GenreContent({ params, searchParams }: PageProps<"/the-loai/[slug]">) {
  const { slug } = await params;
  const genre = await findGenre(slug);
  if (!genre) notFound();
  const { filters, page, raw } = parseFilters(await searchParams, { genre: slug });
  const [result, options] = await Promise.all([listMovies(filters, page), getFilterOptions()]);
  return (
    <MovieListView
      title={`Phim ${genre.name}`}
      result={result}
      options={options}
      values={raw}
      hide={["the-loai"]}
      basePath={`/the-loai/${slug}`}
    />
  );
}
