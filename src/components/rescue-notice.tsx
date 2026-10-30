"use client";

import { LifeBuoy } from "lucide-react";
import { useEffect, useState } from "react";
import { requestRescue } from "@/app/actions/feedback";

/**
 * Hiện khi phim / tập không còn server nào xem được: tự nhờ hệ thống tìm nguồn thay thế
 * (mỗi phim chỉ gửi một lần trong phiên trình duyệt; worker còn có thời gian chờ riêng).
 */
export function RescueNotice({ movieId, title }: { movieId: number; title: string }) {
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    const key = `phim:rescue:${movieId}`;
    try {
      if (sessionStorage.getItem(key)) {
        queueMicrotask(() => setQueued(true));
        return;
      }
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage bị chặn: vẫn gửi
    }
    requestRescue(movieId)
      .then((result) => setQueued(result.queued))
      .catch(() => {});
  }, [movieId]);

  return (
    <div className="animate-scale-in rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/10 to-accent-2/5 p-6 text-center">
      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-accent/15 text-accent">
        <LifeBuoy className="size-6 animate-[spin_6s_linear_infinite]" aria-hidden />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        {queued
          ? "Hệ thống đang tự tìm nguồn phát thay thế từ các nguồn khác. Vui lòng quay lại sau ít phút."
          : "Các server hiện tại đều lỗi. Chúng tôi sẽ kiểm tra và cập nhật nguồn mới sớm nhất."}
      </p>
    </div>
  );
}
