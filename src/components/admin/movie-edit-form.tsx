"use client";

import { useActionState } from "react";
import { updateMovie } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui";
import { STATUS_LABELS, TYPE_LABELS } from "@/lib/site";

interface EditableMovie {
  id: number;
  name: string;
  originName: string;
  description: string;
  posterUrl: string | null;
  thumbUrl: string | null;
  type: keyof typeof TYPE_LABELS;
  status: keyof typeof STATUS_LABELS;
  year: number | null;
}

export function MovieEditForm({ movie }: { movie: EditableMovie }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateMovie.bind(null, movie.id), {});
  const field = (label: string, input: React.ReactNode) => (
    <label className="block space-y-1">
      <span className="text-xs text-muted">{label}</span>
      {input}
    </label>
  );
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {field("Tên", <input name="name" defaultValue={movie.name} required className="field" />)}
        {field("Tên gốc", <input name="originName" defaultValue={movie.originName} className="field" />)}
        {field("Ảnh poster (URL)", <input name="posterUrl" defaultValue={movie.posterUrl ?? ""} className="field" />)}
        {field("Ảnh ngang (URL)", <input name="thumbUrl" defaultValue={movie.thumbUrl ?? ""} className="field" />)}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {field(
          "Loại",
          <select name="type" defaultValue={movie.type} className="field">
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>,
        )}
        {field(
          "Trạng thái",
          <select name="status" defaultValue={movie.status} className="field">
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>,
        )}
        {field("Năm", <input name="year" type="number" min={1900} max={2100} defaultValue={movie.year ?? ""} className="field" />)}
      </div>
      {field("Nội dung", <textarea name="description" defaultValue={movie.description} rows={6} className="field" />)}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="ok">{state.message}</Alert>}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Đang lưu…" : "Lưu thay đổi"}
      </button>
    </form>
  );
}
