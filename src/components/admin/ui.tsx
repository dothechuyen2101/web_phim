import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

export function AdminTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{children}</h1>
      {aside}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-xl border border-line bg-surface p-4", className)}>{children}</div>;
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ className, children }: { className?: string; children?: ReactNode }) {
  return <td className={cn("px-3 py-2 align-top", className)}>{children}</td>;
}

/** Nút gọi server action (đã bind tham số). Chạy được cả khi chưa tải JS. */
export function ActionButton({
  action,
  children,
  tone = "ghost",
}: {
  action: () => Promise<void>;
  children: ReactNode;
  tone?: "ghost" | "primary" | "danger";
}) {
  return (
    <form action={action} className="inline">
      <button
        type="submit"
        className={cn(
          "btn px-2.5! py-1! text-xs!",
          tone === "primary" ? "btn-primary" : "btn-ghost",
          tone === "danger" && "text-danger",
        )}
      >
        {children}
      </button>
    </form>
  );
}

export function StatusPill({ tone, children }: { tone: "ok" | "warn" | "error" | "muted"; children: ReactNode }) {
  const tones = {
    ok: "bg-ok/15 text-ok",
    warn: "bg-accent/15 text-accent",
    error: "bg-danger/15 text-danger",
    muted: "bg-surface-2 text-muted",
  };
  return <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export function AdminSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
