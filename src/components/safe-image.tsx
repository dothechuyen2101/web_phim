"use client";

import { Film } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Ảnh từ CDN của nguồn, có dự phòng: không có ảnh hoặc CDN lỗi thì hiện nền gradient kèm tên phim.
 * (Không ẩn ảnh chờ onLoad: ảnh đã có trong cache có thể tải xong trước khi React gắn sự kiện.)
 */
export function SafeImage({
  src,
  alt,
  sizes,
  priority,
  className,
  label,
}: {
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  /** chữ hiện trên ảnh dự phòng (thường là tên phim) */
  label?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-surface-2 via-surface to-bg p-3 text-center">
        <div className="flex flex-col items-center gap-2 text-muted">
          <Film className="size-7 opacity-60" aria-hidden />
          {label && <span className="line-clamp-3 text-xs font-medium">{label}</span>}
        </div>
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      onError={() => setFailedSrc(src)}
      className={cn("object-cover", className)}
    />
  );
}
