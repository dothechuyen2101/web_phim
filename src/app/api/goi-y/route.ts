import { NextResponse, type NextRequest } from "next/server";
import { searchMovies } from "@/lib/queries";

/** Gợi ý cho ô tìm kiếm ở header. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100) ?? "";
  if (q.length < 2) return NextResponse.json({ items: [] });
  const { items } = await searchMovies(q, 1, 8);
  return NextResponse.json(
    {
      items: items.map(({ slug, name, originName, posterUrl, year, episodeCurrent }) => ({
        slug, name, originName, posterUrl, year, episodeCurrent,
      })),
    },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}
