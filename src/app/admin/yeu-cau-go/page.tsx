import type { Metadata } from "next";
import { Suspense } from "react";
import { hideMoviesFromTakedown, setTakedownStatus } from "@/app/actions/admin";
import { ActionButton, AdminSkeleton, AdminTitle, Card, StatusPill } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Yêu cầu gỡ" };

const STATUS = {
  PENDING: { label: "Chờ xử lý", tone: "warn" },
  DONE: { label: "Đã gỡ", tone: "ok" },
  REJECTED: { label: "Từ chối", tone: "muted" },
} as const;

export default function TakedownsPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Takedowns />
    </Suspense>
  );
}

async function Takedowns() {
  await requireAdmin();
  const requests = await db.takedownRequest.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200 });

  return (
    <>
      <AdminTitle>Yêu cầu gỡ nội dung</AdminTitle>
      <p className="mb-5 text-sm text-muted">
        “Ẩn các phim trong yêu cầu” sẽ ẩn mọi phim có đường dẫn <code>/phim/…</code> hoặc <code>/xem/…</code> trong yêu cầu. Phim khác
        có thể ẩn thủ công ở mục Phim.
      </p>
      {requests.length === 0 ? (
        <EmptyState title="Chưa có yêu cầu nào" />
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <Card key={request.id}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={STATUS[request.status].tone}>{STATUS[request.status].label}</StatusPill>
                <span className="font-semibold">{request.contactName}</span>
                <a href={`mailto:${request.contactEmail}`} className="text-sm text-accent hover:underline">
                  {request.contactEmail}
                </a>
                <span className="ml-auto text-xs text-muted">
                  {formatDateTime(request.createdAt)}
                  {request.handledAt && ` · xử lý ${formatDateTime(request.handledAt)}`}
                </span>
              </div>
              <pre className="mt-3 whitespace-pre-wrap break-all rounded-lg bg-surface-2 p-3 text-xs">{request.urls}</pre>
              <p className="mt-3 whitespace-pre-line text-sm text-muted">{request.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {request.status === "PENDING" ? (
                  <>
                    <ActionButton action={hideMoviesFromTakedown.bind(null, request.id)} tone="primary">
                      Ẩn các phim trong yêu cầu
                    </ActionButton>
                    <ActionButton action={setTakedownStatus.bind(null, request.id, "DONE")}>Đánh dấu đã xử lý</ActionButton>
                    <ActionButton action={setTakedownStatus.bind(null, request.id, "REJECTED")} tone="danger">
                      Từ chối
                    </ActionButton>
                  </>
                ) : (
                  <ActionButton action={setTakedownStatus.bind(null, request.id, "PENDING")}>Mở lại</ActionButton>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
