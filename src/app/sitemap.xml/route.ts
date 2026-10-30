import { connection } from "next/server";
import { SITE_URL } from "@/lib/site";
import { sitemapChunkCount, xmlEscape, xmlResponse } from "@/lib/sitemap";

/** Sitemap index: trang tĩnh + các sitemap con chứa phim. Tạo lúc chạy (build không cần DB). */
export async function GET() {
  await connection();
  const chunks = await sitemapChunkCount();
  const entries = [
    `${SITE_URL}/sitemaps/pages.xml`,
    ...Array.from({ length: chunks }, (_, i) => `${SITE_URL}/sitemaps/${i}.xml`),
  ];
  return xmlResponse(
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
      .map((loc) => `  <sitemap><loc>${xmlEscape(loc)}</loc></sitemap>`)
      .join("\n")}\n</sitemapindex>\n`,
  );
}
