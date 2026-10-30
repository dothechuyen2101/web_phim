import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Suspense, ViewTransition, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6", className)}>{children}</div>;
}

/**
 * Suspense có hiệu ứng: skeleton trượt xuống mờ đi, nội dung thật trượt lên hiện ra
 * (View Transitions — trình duyệt không hỗ trợ thì chỉ đơn giản là thay nội dung).
 */
export function Reveal({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <ViewTransition exit="slide-down" default="none">
          <div>{fallback}</div>
        </ViewTransition>
      }
    >
      <ViewTransition enter="slide-up" default="none">
        <div>{children}</div>
      </ViewTransition>
    </Suspense>
  );
}

export function SectionHeader({ title, href, action = "Xem tất cả" }: { title: string; href?: string; action?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="flex items-center gap-2.5 text-lg font-bold tracking-tight sm:text-xl">
        <span className="h-5 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" aria-hidden />
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="group flex shrink-0 items-center gap-1 text-sm text-muted transition-colors hover:text-accent"
        >
          {action}
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
        </Link>
      )}
    </div>
  );
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn("skeleton rounded-xl", className)} style={style} />;
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[2/3]" />
          <Skeleton className="mt-2.5 h-4 w-3/4 rounded-md" />
          <Skeleton className="mt-1.5 h-3 w-1/2 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="animate-fade-in rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      {icon && <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-surface-2 text-muted">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Alert({ tone, children }: { tone: "error" | "ok"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "animate-scale-in rounded-xl border px-3 py-2 text-sm",
        tone === "error" ? "border-danger/40 bg-danger/10 text-danger" : "border-ok/40 bg-ok/10 text-ok",
      )}
    >
      {children}
    </p>
  );
}
