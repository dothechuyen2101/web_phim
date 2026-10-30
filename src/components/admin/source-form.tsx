"use client";

import { useActionState } from "react";
import { updateSource } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/auth";

export function SourceForm({
  source,
}: {
  source: { id: number; baseUrl: string; mirrors: string[]; priority: number; enabled: boolean };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateSource.bind(null, source.id), {});
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-64 flex-1 space-y-1">
          <span className="text-xs text-muted">Base URL</span>
          <input name="baseUrl" defaultValue={source.baseUrl} required className="field py-1.5!" />
        </label>
        <label className="w-24 space-y-1">
          <span className="text-xs text-muted">Ưu tiên</span>
          <input name="priority" type="number" min={0} max={100} defaultValue={source.priority} className="field py-1.5!" />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input name="enabled" type="checkbox" defaultChecked={source.enabled} className="accent-accent" /> Bật
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-muted">
          Domain dự phòng (mirror) — mỗi dòng một URL, tự dùng khi domain chính lỗi mạng / 5xx
        </span>
        <textarea name="mirrors" defaultValue={source.mirrors.join("\n")} rows={2} placeholder="https://..." className="field py-1.5! font-mono text-xs!" />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary py-1.5!">
          Lưu
        </button>
        {state.error && <p className="text-xs text-danger">{state.error}</p>}
        {state.message && <p className="text-xs text-ok">{state.message}</p>}
      </div>
    </form>
  );
}
