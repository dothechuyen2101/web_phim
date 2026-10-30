import Link from "next/link";
import { Suspense } from "react";
import { AdminSkeleton, AdminTitle, Card, StatusPill, Table, Td } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

const RUN_TONE = { RUNNING: "warn", SUCCESS: "ok", FAILED: "error" } as const;

function duration(start: Date, end: Date | null) {
  if (!end) return "—";
  const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m${seconds % 60}s`;
}

/** Số link đã kiểm tra trong 24h và số nguồn đang bị tạm dừng (circuit breaker). */
function linkHealthStats() {
  const now = Date.now();
  return Promise.all([
    db.episodeLink.count({ where: { checkedAt: { gte: new Date(now - 24 * 60 * 60_000) } } }),
    db.source.count({ where: { pausedUntil: { gt: new Date(now) } } }),
  ]);
}

async function Dashboard() {
  await requireAdmin();
  const [movies, hidden, episodes, links, broken, users, reports, takedowns, runs] = await Promise.all([
    db.movie.count(),
    db.movie.count({ where: { hidden: true } }),
    db.episode.count(),
    db.episodeLink.count(),
    db.episodeLink.count({ where: { broken: true } }),
    db.user.count(),
    db.report.count({ where: { resolved: false } }),
    db.takedownRequest.count({ where: { status: "PENDING" } }),
    db.crawlRun.findMany({ orderBy: { startedAt: "desc" }, take: 20, include: { source: { select: { name: true } } } }),
  ]);
  const [checked24h, pausedSources] = await linkHealthStats();

  const stats: [string, number, string?][] = [
    ["Phim", movies],
    ["Đang ẩn", hidden, "/admin/phim?an=1"],
    ["Tập phim", episodes],
    ["Link nhúng", links],
    ["Link hỏng", broken],
    ["Link đã kiểm tra (24h)", checked24h],
    ["Nguồn đang tạm dừng", pausedSources, "/admin/nguon"],
    ["Người dùng", users],
    ["Báo lỗi chờ xử lý", reports, "/admin/bao-loi"],
    ["Yêu cầu gỡ chờ xử lý", takedowns, "/admin/yeu-cau-go"],
  ];

  return (
    <>
      <AdminTitle>Tổng quan</AdminTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([label, value, href]) => {
          const body = (
            <Card className={href ? "transition-colors hover:border-accent" : undefined}>
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-1 text-2xl font-bold">{value.toLocaleString("vi-VN")}</p>
            </Card>
          );
          return href ? (
            <Link key={label} href={href}>
              {body}
            </Link>
          ) : (
            <div key={label}>{body}</div>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold">Các lần đồng bộ gần đây</h2>
      <Table head={["Nguồn", "Loại", "Trạng thái", "Bắt đầu", "Thời gian", "Kết quả"]}>
        {runs.map((run) => {
          const stats = (run.stats ?? {}) as Record<string, number>;
          return (
            <tr key={run.id}>
              <Td>{run.source.name}</Td>
              <Td>{run.kind}</Td>
              <Td>
                <StatusPill tone={RUN_TONE[run.status]}>{run.status}</StatusPill>
              </Td>
              <Td className="whitespace-nowrap">{formatDateTime(run.startedAt)}</Td>
              <Td>{duration(run.startedAt, run.finishedAt)}</Td>
              <Td className="text-xs text-muted">
                {run.error ? (
                  <span className="text-danger">{run.error}</span>
                ) : (
                  `${stats.pages ?? 0} trang · mới ${stats.created ?? 0} · cập nhật ${stats.updated ?? 0} · lỗi ${stats.failed ?? 0}`
                )}
              </Td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
