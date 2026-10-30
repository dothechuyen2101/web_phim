"use client";

import { Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleFavorite } from "@/app/actions/library";
import { NewEpisodeAlert } from "@/components/push-toggle";
import { cn } from "@/lib/utils";

export function FavoriteButton({ movieId, initial, loggedIn }: { movieId: number; initial: boolean; loggedIn: boolean }) {
  const [favorited, setFavorited] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  const onClick = () => {
    if (!loggedIn) {
      router.push(`/dang-nhap?next=${encodeURIComponent(pathname)}`);
      return;
    }
    startTransition(async () => {
      const result = await toggleFavorite(movieId);
      if ("favorited" in result) setFavorited(result.favorited);
      else router.push(`/dang-nhap?next=${encodeURIComponent(pathname)}`);
    });
  };

  return (
    <>
      <button type="button" onClick={onClick} disabled={pending} aria-pressed={favorited} className="btn btn-ghost">
        <Heart className={cn("size-4", favorited && "fill-danger text-danger")} />
        {favorited ? "Đã yêu thích" : "Yêu thích"}
      </button>
      {/* Phim yêu thích được báo khi có tập mới: gợi ý bật thông báo nếu thiết bị chưa bật */}
      {favorited && loggedIn && <NewEpisodeAlert />}
    </>
  );
}
