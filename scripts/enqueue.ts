/**
 * Gửi một job cho worker (worker phải đang chạy để xử lý):
 *   npm run enqueue -- --source kkphim --mode one --slug giao-phong
 *   npm run enqueue -- --source all --mode backfill
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import { enqueueSync, type SyncMode } from "@/ingest/jobs";

const { values } = parseArgs({
  options: {
    source: { type: "string", default: "all" },
    mode: { type: "string", default: "incremental" },
    slug: { type: "string" },
    restart: { type: "boolean", default: false },
  },
});

async function main() {
  const id = await enqueueSync({
    source: values.source!,
    mode: values.mode as SyncMode,
    slug: values.slug,
    restart: values.restart,
  });
  console.log(id ? `Đã gửi job ${id}` : "Job cùng loại đang chờ hoặc đang chạy, bỏ qua");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
