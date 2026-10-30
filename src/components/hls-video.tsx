"use client";

import type Hls from "hls.js";
import { useEffect, useEffectEvent, useRef } from "react";

/**
 * Player HLS riêng — dùng làm server dự phòng khi trang player của nguồn lỗi.
 * Chỉ dùng cho luồng mà máy chủ của nguồn cho phép phát cross-origin (CORS `*`).
 * Khác iframe, ở đây biết chắc video có phát được không nên báo lỗi để tự chuyển server.
 */
export function HlsVideo({
  src,
  poster,
  title,
  onReady,
  onFatal,
}: {
  src: string;
  poster?: string | null;
  title: string;
  onReady: () => void;
  onFatal: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const fail = useEffectEvent(onFatal);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let hls: Hls | null = null;
    let cancelled = false;
    const onNativeError = () => fail();

    // Ưu tiên hls.js (MSE) — ổn định trên mọi trình duyệt desktop; HLS gốc của trình duyệt (Safari iOS)
    // chỉ dùng khi không có MSE. hls.js được tải động để không làm nặng trang.
    import("hls.js")
      .then(({ default: HlsClass }) => {
        if (cancelled) return;
        if (!HlsClass.isSupported()) {
          if (!video.canPlayType("application/vnd.apple.mpegurl")) return fail();
          video.addEventListener("error", onNativeError);
          video.src = src;
          return;
        }
        let recovered = false;
        hls = new HlsClass({ maxBufferLength: 30, enableWorker: true });
        hls.on(HlsClass.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          console.warn("[hls] lỗi nghiêm trọng:", data.type, data.details);
          // Lỗi giải mã: thử khôi phục một lần trước khi bỏ server này
          if (data.type === HlsClass.ErrorTypes.MEDIA_ERROR && !recovered) {
            recovered = true;
            hls?.recoverMediaError();
            return;
          }
          fail();
        });
        hls.loadSource(src);
        hls.attachMedia(video);
      })
      .catch(() => fail());

    return () => {
      cancelled = true;
      video.removeEventListener("error", onNativeError);
      hls?.destroy();
    };
  }, [src]);

  return (
    <video
      ref={ref}
      title={title}
      controls
      playsInline
      preload="metadata"
      poster={poster ?? undefined}
      // Không bắt onError ở đây: khi dùng hls.js, thẻ video báo lỗi tạm thời (ví dụ bấm play trước khi
      // hls.js gắn nguồn) — chỉ lỗi "fatal" do hls.js báo mới là luồng hỏng thật
      onLoadedData={onReady}
      className="absolute inset-0 size-full bg-black"
    />
  );
}
