"use client";

import type Hls from "hls.js";
import { useLayoutEffect, useEffectEvent, useRef } from "react";

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
  /** Vị trí đang xem lúc trang bị ẩn, để tua lại khi quay về. */
  const resumeAt = useRef(0);
  const fail = useEffectEvent(onFatal);

  // useLayoutEffect: dọn dẹp chạy ngay khi rời trang (Next.js chỉ ẩn trang cũ bằng <Activity>, video vẫn phát tiếp)
  useLayoutEffect(() => {
    const video = ref.current;
    if (!video) return;
    let hls: Hls | null = null;
    let cancelled = false;
    const onNativeError = () => fail();
    const resumeFrom = resumeAt.current;
    const onMetadata = () => {
      if (resumeFrom > 0) video.currentTime = resumeFrom;
    };

    // Ưu tiên hls.js (MSE) — ổn định trên mọi trình duyệt desktop; HLS gốc của trình duyệt (Safari iOS)
    // chỉ dùng khi không có MSE. hls.js được tải động để không làm nặng trang.
    import("hls.js")
      .then(({ default: HlsClass }) => {
        if (cancelled) return;
        if (!HlsClass.isSupported()) {
          if (!video.canPlayType("application/vnd.apple.mpegurl")) return fail();
          video.addEventListener("error", onNativeError);
          video.addEventListener("loadedmetadata", onMetadata, { once: true });
          video.src = src;
          return;
        }
        let recovered = false;
        // startPosition: hls.js tự tua về điểm bắt đầu sau khi tải, nên vị trí cũ phải truyền qua cấu hình
        hls = new HlsClass({ maxBufferLength: 30, enableWorker: true, startPosition: resumeFrom > 0 ? resumeFrom : -1 });
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
      // Chỉ lưu khi video đã tải (readyState > 0): lần dọn dẹp lúc luồng chưa kịp tải sẽ không xóa vị trí cũ
      if (video.readyState > 0) resumeAt.current = video.currentTime;
      video.pause();
      video.removeEventListener("error", onNativeError);
      video.removeEventListener("loadedmetadata", onMetadata);
      hls?.destroy();
      // HLS gốc (Safari): bỏ nguồn để trình duyệt ngừng tải luồng
      if (!hls && video.getAttribute("src")) {
        video.removeAttribute("src");
        video.load();
      }
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
