/**
 * Gộp phim bộ bị trùng do nguồn không ghi số mùa TMDB (bản "tv:id:0" nằm cạnh bản "tv:id:N"):
 *   npm run merge-duplicates            (chỉ liệt kê)
 *   npm run merge-duplicates -- --apply (gộp thật)
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import { findSeasonDuplicates, mergeMovies } from "@/ingest/merge";
import { notifyRevalidate } from "@/ingest/revalidate";
import { db } from "@/lib/db";

const { values } = parseArgs({ options: { apply: { type: "boolean", default: false } } });

async function main() {
  const pairs = await findSeasonDuplicates();
  if (pairs.length === 0) {
    console.log("Không có phim trùng.");
    return;
  }
  for (const pair of pairs) {
    console.log(`${pair.tmdbKey}: giữ "${pair.keepSlug}" (#${pair.keepId}) ← gộp "${pair.dropSlug}" (#${pair.dropId})`);
    if (values.apply) await mergeMovies(pair.keepId, pair.dropId);
  }
  if (values.apply) {
    console.log(`Đã gộp ${pairs.length} cặp.`);
    await notifyRevalidate(pairs.map((p) => p.keepSlug));
  } else {
    console.log("Chạy lại với --apply để gộp.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
