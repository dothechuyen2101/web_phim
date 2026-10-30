"use client";

import { Play, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { removeHistory } from "@/app/actions/library";
import { EmptyState } from "@/components/ui";
import { mergeIntoLocal, removeLocalHistory, type LocalHistoryItem } from "@/lib/local-history";
import { watchUrl } from "@/lib/site";
import { formatDateTime } from "@/lib/utils";

type Item = LocalHistoryItem & { movieId: number };

export function HistoryList({ items: initial }: { items: Item[] }) {
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();

  // Thiết bị mới đăng nhập: nạp lịch sử của tài khoản vào trình duyệt để “Tiếp tục xem” hoạt động
  useEffect(() => {
    mergeIntoLocal(
      initial.map(({ slug, name, posterUrl, episodeKey, episodeName, at }) => ({ slug, name, posterUrl, episodeKey, episodeName, at })),
    );
  }, [initial]);

  const remove = (item: Item) => {
    setItems((list) => list.filter((i) => i.movieId !== item.movieId));
    removeLocalHistory(item.slug);
    startTransition(() => removeHistory(item.movieId));
  };

  if (items.length === 0) return <EmptyState title="Bạn chưa xem phim nào" />;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.movieId} className="flex gap-3 rounded-xl border border-line bg-surface p-2">
          <Link href={watchUrl(item.slug, item.episodeKey)} className="group relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg bg-surface-2">
            {item.posterUrl && <Image src={item.posterUrl} alt="" fill sizes="144px" className="object-cover object-top" />}
            <span className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
              <Play className="size-8 fill-accent text-accent" />
            </span>
          </Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <Link href={watchUrl(item.slug, item.episodeKey)} className="line-clamp-2 text-sm font-semibold hover:text-accent">
              {item.name}
            </Link>
            <p className="text-xs text-muted">Đang xem: {item.episodeName}</p>
            <p className="text-xs text-muted">{formatDateTime(new Date(item.at))}</p>
            <button
              type="button"
              onClick={() => remove(item)}
              className="mt-auto flex items-center gap-1 self-end text-xs text-muted hover:text-danger"
            >
              <Trash2 className="size-3.5" /> Xóa
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
