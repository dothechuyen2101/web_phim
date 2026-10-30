import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/ui";
import { ListSkeleton, MovieListView } from "@/components/movie-list-view";
import { parseFilters } from "@/lib/filters";
import { getFilterOptions, listMovies } from "@/lib/queries";

async function findCountry(slug: string) {
  return (await getFilterOptions()).countries.find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/quoc-gia/[slug]">): Promise<Metadata> {
  const country = await findCountry((await params).slug);
  return country ? { title: `Phim ${country.name}`, description: `Phim ${country.name} Vietsub, thuyết minh mới nhất.` } : {};
}

export default function CountryPage(props: PageProps<"/quoc-gia/[slug]">) {
  return (
    <Reveal fallback={<ListSkeleton />}>
      <CountryContent {...props} />
    </Reveal>
  );
}

async function CountryContent({ params, searchParams }: PageProps<"/quoc-gia/[slug]">) {
  const { slug } = await params;
  const country = await findCountry(slug);
  if (!country) notFound();
  const { filters, page, raw } = parseFilters(await searchParams, { country: slug });
  const [result, options] = await Promise.all([listMovies(filters, page), getFilterOptions()]);
  return (
    <MovieListView
      title={`Phim ${country.name}`}
      result={result}
      options={options}
      values={raw}
      hide={["quoc-gia"]}
      basePath={`/quoc-gia/${slug}`}
    />
  );
}
