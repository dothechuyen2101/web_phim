import type { Metadata } from "next";
import { Suspense } from "react";
import { resumeSource, triggerSync } from "@/app/actions/admin";
import { SourceForm } from "@/components/admin/source-form";
import { ActionButton, AdminSkeleton, AdminTitle, Card, StatusPill } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Nguồn & đồng bộ" };

export default function SourcesPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Sources />
    </Suspense>
  );
}

async function Sources() {
  await requireAdmin();
  const sources = await db.source.findMany({
    orderBy: { priority: "desc" },
    include: { _count: { select: { movieSources: true, links: true } } },
  });

  return (
    <>
      <AdminTitle aside={<ActionButton action={triggerSync.bind(null, "all", "incremental", false)} tone="primary">Đồng bộ tất cả ngay</ActionButton>}>
        Nguồn & đồng bộ
      </AdminTitle>
      <p className="mb-5 text-sm text-muted">
        {process.env.VERCEL ? (
          <>
            Các nút bên dưới chỉ xếp job vào hàng đợi; job được xử lý ở <strong className="text-fg">lần tick kế tiếp</strong> (Supabase pg_cron gọi
            web mỗi 30 phút). Mỗi tick đồng bộ tăng dần mọi nguồn; kiểm tra link sống/chết mỗi giờ và cập nhật thể loại mỗi ngày.
          </>
        ) : (
          <>
            Các nút bên dưới chỉ xếp job vào hàng đợi; <strong className="text-fg">worker</strong> (<code>npm run worker</code>) phải đang chạy
            để xử lý. Worker tự đồng bộ tăng dần mỗi 5 phút (và ngay khi khởi động), kiểm tra link sống/chết mỗi giờ và cập nhật thể loại lúc 3h
            sáng.
          </>
        )}{" "}
        Nguồn lỗi liên tục (bị chặn, sập, đổi domain) sẽ tự tạm dừng 15 phút → 30 phút → … tối đa 6 giờ rồi thử lại.
      </p>
      <div className="space-y-4">
        {sources.map((source) => (
          <Card key={source.id}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold">{source.name}</h2>
              <code className="text-xs text-muted">{source.key}</code>
              <StatusPill tone={source.enabled ? "ok" : "muted"}>{source.enabled ? "Đang bật" : "Đã tắt"}</StatusPill>
              {source.pausedUntil && source.pausedUntil > new Date() && (
                <StatusPill tone="error">Tạm dừng tới {formatDateTime(source.pausedUntil)}</StatusPill>
              )}
            </div>
            {source.lastError && (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm">
                <span className="text-danger">
                  Lỗi gần nhất (lần thứ {source.failureStreak} liên tiếp): {source.lastError}
                </span>
                {source.pausedUntil && source.pausedUntil > new Date() && (
                  <ActionButton action={resumeSource.bind(null, source.id)}>Mở lại ngay</ActionButton>
                )}
              </div>
            )}
            <dl className="mb-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <div>
                <dt className="text-xs text-muted">Phim liên kết</dt>
                <dd>{source._count.movieSources.toLocaleString("vi-VN")}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Link nhúng</dt>
                <dd>{source._count.links.toLocaleString("vi-VN")}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Đồng bộ lần cuối</dt>
                <dd>{formatDateTime(source.lastSyncedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Backfill</dt>
                <dd>{source.backfillCursor ? `đang dở, trang ${source.backfillCursor}` : "—"}</dd>
              </div>
            </dl>
            <SourceForm source={source} />
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
              <ActionButton action={triggerSync.bind(null, source.key, "incremental", false)}>Đồng bộ ngay</ActionButton>
              <ActionButton action={triggerSync.bind(null, source.key, "backfill", false)}>
                {source.backfillCursor ? "Chạy tiếp backfill" : "Backfill toàn bộ kho"}
              </ActionButton>
              <ActionButton action={triggerSync.bind(null, source.key, "backfill", true)} tone="danger">
                Backfill lại từ đầu
              </ActionButton>
              <ActionButton action={triggerSync.bind(null, source.key, "taxonomy", false)}>Cập nhật thể loại</ActionButton>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
