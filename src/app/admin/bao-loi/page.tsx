import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { resolveReport, resolveReportAsBroken, setMovieHidden } from "@/app/actions/admin";
import { ActionButton, AdminSkeleton, AdminTitle, StatusPill, Table, Td } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Báo lỗi" };

export default function ReportsPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Reports />
    </Suspense>
  );
}

async function Reports() {
  await requireAdmin();
  const reports = await db.report.findMany({
    orderBy: [{ resolved: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      movie: { select: { id: true, name: true, hidden: true } },
      episodeLink: { include: { episode: { select: { name: true } }, source: { select: { name: true } } } },
    },
  });

  return (
    <>
      <AdminTitle>Báo lỗi từ người xem</AdminTitle>
      {reports.length === 0 ? (
        <EmptyState title="Chưa có báo lỗi nào" />
      ) : (
        <Table head={["Thời gian", "Phim / tập", "Server", "Lý do", "Trạng thái", ""]}>
          {reports.map((report) => (
            <tr key={report.id} className={report.resolved ? "opacity-50" : undefined}>
              <Td className="whitespace-nowrap text-xs">{formatDateTime(report.createdAt)}</Td>
              <Td>
                <Link href={`/admin/phim/${report.movie.id}`} className="font-medium hover:text-accent">
                  {report.movie.name}
                </Link>
                {report.episodeLink && <p className="text-xs text-muted">{report.episodeLink.episode.name}</p>}
              </Td>
              <Td className="whitespace-nowrap text-xs">
                {report.episodeLink ? (
                  <>
                    {report.episodeLink.source.name} · {report.episodeLink.serverName}
                    {report.episodeLink.broken && <StatusPill tone="error">hỏng</StatusPill>}
                  </>
                ) : (
                  "—"
                )}
              </Td>
              <Td className="text-xs">{report.reason}</Td>
              <Td>{report.resolved ? <StatusPill tone="muted">Đã xử lý</StatusPill> : <StatusPill tone="warn">Chờ</StatusPill>}</Td>
              <Td>
                {!report.resolved && (
                  <span className="flex flex-wrap gap-1.5">
                    <ActionButton action={resolveReport.bind(null, report.id)}>Đã xử lý</ActionButton>
                    {report.episodeLinkId && (
                      <ActionButton action={resolveReportAsBroken.bind(null, report.id)} tone="danger">
                        Link hỏng
                      </ActionButton>
                    )}
                    {!report.movie.hidden && (
                      <ActionButton action={setMovieHidden.bind(null, report.movie.id, true)} tone="danger">
                        Ẩn phim
                      </ActionButton>
                    )}
                  </span>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
