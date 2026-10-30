"use client";

import { Play } from "lucide-react";
import Link from "next/link";
import { useLocalHistory } from "@/lib/local-history";
import { watchUrl } from "@/lib/site";

/** "Xem phim" → tập đầu; nếu đã xem dở thì đổi thành "Xem tiếp Tập X". */
export function ResumeButton({ slug, firstKey, keys }: { slug: string; firstKey: string; keys: string[] }) {
  const item = useLocalHistory().find((i) => i.slug === slug);
  const resume = item && item.episodeKey !== firstKey && keys.includes(item.episodeKey) ? item : null;

  return (
    <Link href={watchUrl(slug, resume?.episodeKey ?? firstKey)} className="btn btn-primary px-6!">
      <Play className="size-4 fill-current" />
      {resume ? `Xem tiếp ${resume.episodeName}` : "Xem phim"}
    </Link>
  );
}
