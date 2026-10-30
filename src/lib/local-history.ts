import { useMemo, useSyncExternalStore } from "react";

/** Lịch sử xem lưu trong trình duyệt (dùng cho cả khách lẫn người đã đăng nhập). Chỉ gọi ở client. */
export interface LocalHistoryItem {
  slug: string;
  name: string;
  posterUrl: string | null;
  episodeKey: string;
  episodeName: string;
  at: number;
  /** đã gộp lên tài khoản hay chưa */
  synced?: boolean;
}

const KEY = "phim:history";
const LIMIT = 60;
export const HISTORY_EVENT = "phim:history-change";

function rawSnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(raw: string): LocalHistoryItem[] {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? (value as LocalHistoryItem[]).filter((i) => i && typeof i.slug === "string") : [];
  } catch {
    return [];
  }
}

export function readHistory(): LocalHistoryItem[] {
  return parse(rawSnapshot());
}

function subscribe(callback: () => void) {
  window.addEventListener(HISTORY_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(HISTORY_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** Lịch sử xem dạng React state: server render ra rỗng, client cập nhật khi localStorage thay đổi. */
export function useLocalHistory(): LocalHistoryItem[] {
  const raw = useSyncExternalStore(subscribe, rawSnapshot, () => "[]");
  return useMemo(() => parse(raw), [raw]);
}

function write(items: LocalHistoryItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, LIMIT)));
    window.dispatchEvent(new Event(HISTORY_EVENT));
  } catch {
    // localStorage bị chặn (chế độ riêng tư…): bỏ qua
  }
}

export function pushHistory(item: Omit<LocalHistoryItem, "at">, synced = false) {
  write([{ ...item, at: Date.now(), synced }, ...readHistory().filter((i) => i.slug !== item.slug)]);
}

export function removeLocalHistory(slug: string) {
  write(readHistory().filter((i) => i.slug !== slug));
}

export function markAllSynced() {
  write(readHistory().map((i) => ({ ...i, synced: true })));
}

/** Nạp lịch sử từ tài khoản vào trình duyệt (thiết bị mới đăng nhập). Bản local mới hơn được giữ nguyên. */
export function mergeIntoLocal(items: LocalHistoryItem[]) {
  const bySlug = new Map(readHistory().map((i) => [i.slug, i]));
  for (const item of items) {
    const local = bySlug.get(item.slug);
    if (!local || local.at < item.at) bySlug.set(item.slug, { ...item, synced: true });
  }
  write([...bySlug.values()].sort((a, b) => b.at - a.at));
}
