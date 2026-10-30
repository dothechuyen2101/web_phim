import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { MOVIES_TAG } from "@/lib/queries";

/** Số phim trong mỗi file sitemap con (giới hạn của Google là 50.000 URL). */
export const SITEMAP_CHUNK = 10_000;

export async function sitemapChunkCount() {
  "use cache";
  cacheLife("hours");
  cacheTag(MOVIES_TAG);
  return Math.max(1, Math.ceil((await db.movie.count({ where: { hidden: false } })) / SITEMAP_CHUNK));
}

export async function sitemapChunk(index: number) {
  "use cache";
  cacheLife("hours");
  cacheTag(MOVIES_TAG);
  return db.movie.findMany({
    where: { hidden: false },
    orderBy: { id: "asc" },
    skip: index * SITEMAP_CHUNK,
    take: SITEMAP_CHUNK,
    select: { slug: true, updatedAt: true },
  });
}

export const xmlEscape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function xmlResponse(xml: string) {
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
