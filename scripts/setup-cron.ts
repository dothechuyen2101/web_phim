/**
 * Lập lịch "nhịp đồng bộ" cho bản triển khai trên Vercel bằng Supabase pg_cron + pg_net:
 * cứ mỗi 30 phút (đổi bằng --schedule) Postgres gửi POST tới <SITE_URL>/api/cron/tick kèm Authorization: Bearer <CRON_SECRET>.
 * (Vercel Hobby chỉ cho cron 1 lần/ngày nên không dùng được cho việc này.)
 *
 *   npm run setup-cron -- --url https://ten-du-an.vercel.app      (CRON_SECRET lấy từ .env, phải trùng với Vercel)
 *   npm run setup-cron -- --remove                                 (gỡ lịch)
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import { Client } from "pg";

const JOB_NAME = "web-phim-tick";
const { values } = parseArgs({
  options: {
    url: { type: "string" },
    schedule: { type: "string", default: "*/30 * * * *" },
    remove: { type: "boolean", default: false },
  },
});

async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Thiếu DIRECT_URL / DATABASE_URL");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    // Theo hướng dẫn của Supabase: pg_cron ở schema pg_catalog, pg_net ở schema extensions
    await client.query("create extension if not exists pg_cron with schema pg_catalog");
    await client.query("create extension if not exists pg_net with schema extensions");
    await client.query("select cron.unschedule(jobid) from cron.job where jobname = $1", [JOB_NAME]);
    if (values.remove) {
      console.log(`Đã gỡ lịch "${JOB_NAME}".`);
      return;
    }

    const site = values.url ?? process.env.SITE_URL;
    const secret = process.env.CRON_SECRET;
    if (!site || !/^https:\/\//.test(site)) throw new Error("Cần --url https://… (địa chỉ web trên Vercel)");
    if (!secret || secret.length < 32) throw new Error("CRON_SECRET trong .env chưa đặt hoặc quá ngắn");
    const endpoint = `${site.replace(/\/+$/, "")}/api/cron/tick`;
    const headers = JSON.stringify({ "Content-Type": "application/json", Authorization: `Bearer ${secret}` });

    // Lệnh do pg_cron chạy: tham số được nhúng dưới dạng literal đã escape bằng format(%L)
    const command = (
      await client.query(
        "select format('select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb, timeout_milliseconds := 10000)', $1::text, $2::text, $3::text) as sql",
        [endpoint, headers, "{}"],
      )
    ).rows[0].sql as string;
    await client.query("select cron.schedule($1, $2, $3)", [JOB_NAME, values.schedule, command]);
    console.log(`Đã lập lịch "${JOB_NAME}" (${values.schedule}) → POST ${endpoint}`);
    console.log("Xem lịch sử chạy: select * from cron.job_run_details order by start_time desc limit 10;");
    console.log("Xem phản hồi HTTP: select status_code, created from net._http_response order by created desc limit 10;");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
