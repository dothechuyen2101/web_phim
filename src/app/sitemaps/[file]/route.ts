import { connection } from "next/server";
import { LIST_TYPES, NAV_COUNTRIES, NAV_GENRES, SITE_URL, movieUrl } from "@/lib/site";
import { sitemapChunk, sitemapChunkCount, xmlEscape, xmlResponse } from "@/lib/sitemap";

function urlset(entries: { loc: string; lastmod?: Date }[]) {
  const body = entries
    .map(({ loc, lastmod }) =>
      lastmod
        ? `  <url><loc>${xmlEscape(loc)}</loc><lastmod>${lastmod.toISOString()}</lastmod></url>`
        : `  <url><loc>${xmlEscape(loc)}</loc></url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/** /sitemaps/pages.xml (trang danh mục) và /sitemaps/{n}.xml (phim). */
export async function GET(_: Request, { params }: RouteContext<"/sitemaps/[file]">) {
  await connection();
  const { file } = await params;

  if (file === "pages.xml") {
    const paths = [
      "/",
      ...Object.keys(LIST_TYPES).map((slug) => `/danh-sach/${slug}`),
      ...NAV_GENRES.map(([slug]) => `/the-loai/${slug}`),
      ...NAV_COUNTRIES.map(([slug]) => `/quoc-gia/${slug}`),
    ];
    return xmlResponse(urlset(paths.map((path) => ({ loc: `${SITE_URL}${path}` }))));
  }

  const match = file.match(/^(\d+)\.xml$/);
  const index = match ? Number(match[1]) : -1;
  if (index < 0 || index >= (await sitemapChunkCount())) return new Response("Not found", { status: 404 });
  const movies = await sitemapChunk(index);
  return xmlResponse(urlset(movies.map((m) => ({ loc: `${SITE_URL}${movieUrl(m.slug)}`, lastmod: m.updatedAt }))));
}
