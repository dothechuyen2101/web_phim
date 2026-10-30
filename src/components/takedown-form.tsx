"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { submitTakedown } from "@/app/actions/feedback";
import { Alert } from "@/components/ui";

export function TakedownForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(submitTakedown, {});
  if (state.message) {
    return (
      <div className="mt-6">
        <Alert tone="ok">{state.message}</Alert>
      </div>
    );
  }
  return (
    <form action={action} className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm text-muted">Họ tên / Tổ chức</span>
          <input name="contactName" required maxLength={120} className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm text-muted">Email liên hệ</span>
          <input name="contactEmail" type="email" required maxLength={200} className="field" />
        </label>
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm text-muted">Đường dẫn nội dung cần gỡ (mỗi dòng một đường dẫn)</span>
        <textarea name="urls" required rows={4} maxLength={5000} placeholder="https://…/phim/ten-phim" className="field" />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-muted">Mô tả yêu cầu và căn cứ quyền sở hữu</span>
        <textarea name="message" required rows={5} maxLength={5000} className="field" />
      </label>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Đang gửi…" : "Gửi yêu cầu"}
      </button>
    </form>
  );
}
