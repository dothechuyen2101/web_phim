"use client";

import { useEffect } from "react";
import { mergeHistory } from "@/app/actions/library";
import { markAllSynced, readHistory } from "@/lib/local-history";

/** Khi đã đăng nhập: đẩy lịch sử xem lúc còn là khách (localStorage) lên tài khoản, một lần. */
export function HistorySync() {
  useEffect(() => {
    const pending = readHistory().filter((i) => !i.synced);
    if (pending.length === 0) return;
    mergeHistory(pending.map(({ slug, episodeKey, at }) => ({ slug, episodeKey, at })))
      .then(markAllSynced)
      .catch(() => {});
  }, []);
  return null;
}
