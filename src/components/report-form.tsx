"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { reportLink } from "@/app/actions/feedback";
import { Alert } from "@/components/ui";
import { REPORT_REASONS } from "@/lib/site";

export function ReportForm({
  movieId,
  linkId,
  serverLabel,
  onDone,
}: {
  movieId: number;
  linkId: number;
  serverLabel: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(reportLink, {});

  if (state.message) {
    return (
      <div className="mt-3 space-y-2">
        <Alert tone="ok">{state.message}</Alert>
        <button type="button" onClick={onDone} className="text-sm text-muted hover:text-fg">
          Đóng
        </button>
      </div>
    );
  }
  return (
    <form action={action} className="mt-3 space-y-3 rounded-xl border border-line bg-surface p-4">
      <p className="text-sm">
        Báo lỗi cho server <span className="font-semibold">{serverLabel}</span>
      </p>
      <input type="hidden" name="movieId" value={movieId} />
      <input type="hidden" name="linkId" value={linkId} />
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {Object.entries(REPORT_REASONS).map(([value, label], i) => (
          <label key={value} className="flex items-center gap-2">
            <input type="radio" name="reason" value={value} defaultChecked={i === 0} className="accent-accent" />
            {label}
          </label>
        ))}
      </div>
      <textarea name="note" maxLength={300} rows={2} placeholder="Mô tả thêm (không bắt buộc)" className="field" />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Đang gửi…" : "Gửi báo lỗi"}
        </button>
        <button type="button" onClick={onDone} className="btn btn-ghost">
          Hủy
        </button>
      </div>
    </form>
  );
}
