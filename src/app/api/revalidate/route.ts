import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { MOVIES_TAG, movieTag } from "@/lib/queries";

const body = z.object({ slugs: z.array(z.string().max(200)).max(5000) });

function authorized(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET?.trim();
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("x-revalidate-secret") ?? "");
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Worker gọi sau mỗi lần đồng bộ: đánh dấu cũ các danh sách và trang của phim đã thay đổi. */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  revalidateTag(MOVIES_TAG, "max");
  for (const slug of parsed.data.slugs) revalidateTag(movieTag(slug), "max");
  return NextResponse.json({ ok: true, revalidated: parsed.data.slugs.length });
}
