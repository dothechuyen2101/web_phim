"use client";

import { Flag, LoaderCircle, RefreshCw, Server, TriangleAlert } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { recordWatch } from "@/app/actions/library";
import { reportPlaybackIssue } from "@/app/actions/feedback";
import { HlsVideo } from "@/components/hls-video";
import { ReportForm } from "@/components/report-form";
import { SafeImage } from "@/components/safe-image";
import { pushHistory } from "@/lib/local-history";
import { cn } from "@/lib/utils";

/**
 * - embed: nhúng trang player của nguồn (mặc định)
 * - hls: phát thẳng luồng m3u8 gốc bằng player riêng — dự phòng khi trang player của nguồn lỗi
 */
export interface PlayerServer {
  /** id của EpisodeLink (dùng khi báo lỗi) */
  linkId: number;
  kind: "embed" | "hls";
  label: string;
  url: string;
}

const SERVER_PREF_KEY = "phim:server";
/** Quá thời gian này mà player chưa tải xong thì gợi ý đổi server. */
const SLOW_MS = 15_000;

const serverKey = (s: PlayerServer) => `${s.kind}:${s.url}`;

/** Iframe đang tạm thay bằng about:blank vì trang xem bị ẩn. */
const blankedFrames = new WeakSet<HTMLIFrameElement>();

function readPref() {
  try {
    return localStorage.getItem(SERVER_PREF_KEY);
  } catch {
    return null;
  }
}

function subscribePref(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function Player({
  servers,
  movie,
  episode,
}: {
  servers: PlayerServer[];
  movie: { id: number; slug: string; name: string; imageUrl: string | null };
  episode: { key: string; name: string };
}) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [reporting, setReporting] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [slowKey, setSlowKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Mặc định chọn server người dùng ưa thích (theo nhãn) nếu tập này có; server render luôn là server đầu
  const pref = useSyncExternalStore(subscribePref, readPref, () => null);
  const preferred = pref ? servers.findIndex((s) => s.label === pref) : -1;
  const index = chosen ?? Math.max(preferred, 0);
  const current = servers[index] ?? servers[0];
  const currentKey = current ? serverKey(current) : null;
  const loaded = loadedKey === currentKey;
  const slow = slowKey === currentKey && !loaded;
  const frameRef = useRef<HTMLIFrameElement>(null);

  // Rời trang xem, Next.js không gỡ trang mà chỉ ẩn đi (<Activity>, display: none) nên iframe vẫn phát tiếng.
  // Player của nguồn khác domain, không ra lệnh dừng được: lúc bị ẩn thì bỏ trang player, quay lại thì nạp lại.
  const embedUrl = current?.kind === "embed" ? current.url : null;
  // Dùng location.replace (được phép cả với iframe khác domain): gán src sẽ thêm mục vào lịch sử trình duyệt,
  // khi đó nút Back chỉ lùi trong iframe đang ẩn thay vì quay về trang xem.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || !embedUrl) return;
    if (blankedFrames.delete(frame)) frame.contentWindow?.location.replace(embedUrl);
    return () => {
      blankedFrames.add(frame);
      frame.contentWindow?.location.replace("about:blank");
      setLoadedKey(null);
    };
    // currentKey: đổi server là iframe mới (key khác) dù URL có thể trùng
  }, [embedUrl, currentKey]);

  // Ghi lịch sử xem + lượt xem (mỗi phim chỉ đếm một lần trong một phiên trình duyệt)
  useEffect(() => {
    pushHistory({ slug: movie.slug, name: movie.name, posterUrl: movie.imageUrl, episodeKey: episode.key, episodeName: episode.name });
    let countView = false;
    try {
      const key = `phim:viewed:${movie.slug}`;
      countView = !sessionStorage.getItem(key);
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage bị chặn: không đếm lượt xem
    }
    recordWatch(movie.slug, episode.key, countView).catch(() => {});
  }, [movie.slug, movie.name, movie.imageUrl, episode.key, episode.name]);

  // Player tải quá lâu (host chết / bị chặn) thì gợi ý đổi server
  useEffect(() => {
    if (!currentKey || loaded) return;
    const timer = setTimeout(() => setSlowKey(currentKey), SLOW_MS);
    return () => clearTimeout(timer);
  }, [currentKey, loaded]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const choose = (i: number) => {
    setChosen(i);
    setLoadedKey(null);
    setSlowKey(null);
    try {
      localStorage.setItem(SERVER_PREF_KEY, servers[i].label);
    } catch {
      // bỏ qua
    }
  };

  /** Server hiện tại lỗi: chuyển sang server kế tiếp và ghi nhận nhẹ (đủ người báo thì hệ thống tự xử lý). */
  const failover = (reason?: string) => {
    if (!current || servers.length < 2) return;
    reportPlaybackIssue(movie.id, current.linkId).catch(() => {});
    const next = (index + 1) % servers.length;
    choose(next);
    setToast(`${reason ?? "Đã chuyển"} sang ${servers[next].label}`);
  };

  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl shadow-black/60 ring-1 ring-white/10">
        {current?.kind === "embed" && (
          <iframe
            key={currentKey}
            ref={frameRef}
            src={current.url}
            title={`${movie.name} – ${episode.name}`}
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            // Không dùng "no-referrer": NguonC từ chối khi thiếu Referer
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={(event) => {
              // about:blank (lúc trang bị ẩn) cũng phát sự kiện load: không tính là player đã tải
              if (!blankedFrames.has(event.currentTarget)) setLoadedKey(currentKey);
            }}
            className={cn("absolute inset-0 size-full border-0 transition-opacity duration-700", loaded ? "opacity-100" : "opacity-0")}
          />
        )}
        {current?.kind === "hls" && (
          <HlsVideo
            key={currentKey}
            src={current.url}
            poster={movie.imageUrl}
            title={`${movie.name} – ${episode.name}`}
            onReady={() => setLoadedKey(currentKey)}
            // Player riêng biết chắc luồng hỏng: tự chuyển server, không bắt người xem bấm
            onFatal={() => failover("Luồng lỗi, đã tự chuyển")}
          />
        )}

        {/* Lớp chờ: poster mờ + trạng thái tải, gợi ý đổi server nếu quá lâu */}
        <div
          className={cn("absolute inset-0 transition-opacity duration-700", loaded ? "pointer-events-none opacity-0" : "opacity-100")}
          aria-hidden={loaded}
        >
          <div className="absolute inset-0 scale-110 blur-2xl">
            <SafeImage src={movie.imageUrl} alt="" sizes="100vw" />
          </div>
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            {slow ? (
              <div className="animate-scale-in space-y-3">
                <TriangleAlert className="mx-auto size-9 text-accent" />
                <p className="font-semibold">Server “{current?.label}” phản hồi chậm</p>
                {servers.length > 1 ? (
                  <button type="button" onClick={() => failover()} className="btn btn-primary">
                    <RefreshCw className="size-4" /> Thử server khác
                  </button>
                ) : (
                  <p className="text-sm text-muted">Vui lòng đợi thêm hoặc tải lại trang.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <LoaderCircle className="mx-auto size-10 animate-spin text-accent" />
                <p className="text-sm text-fg/80">Đang tải {current?.label}…</p>
              </div>
            )}
          </div>
        </div>

        {toast && (
          <div className="glass animate-fade-up absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full px-4 py-1.5 text-sm shadow-xl">
            {toast}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm text-muted">
          <Server className="size-4" aria-hidden /> Server:
        </span>
        {servers.map((server, i) => (
          <button
            key={serverKey(server)}
            type="button"
            onClick={() => choose(i)}
            aria-pressed={i === index}
            title={server.kind === "hls" ? "Phát trực tiếp luồng gốc bằng player của web — dùng khi player nguồn lỗi" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-300",
              i === index
                ? "bg-gradient-to-r from-accent to-accent-2 text-accent-fg shadow-lg shadow-accent/25"
                : "bg-white/6 text-fg/85 ring-1 ring-white/10 hover:bg-white/12",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                i === index ? (loaded ? "bg-accent-fg" : "animate-pulse bg-accent-fg/60") : server.kind === "hls" ? "bg-sky-400" : "bg-ok",
              )}
              aria-hidden
            />
            {server.label}
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          {servers.length > 1 && (
            <button
              type="button"
              onClick={() => failover()}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:bg-white/8 hover:text-fg"
            >
              <RefreshCw className="size-4" /> Lỗi phát? Đổi server
            </button>
          )}
          <button
            type="button"
            onClick={() => setReporting((v) => !v)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:bg-white/8 hover:text-fg"
          >
            <Flag className="size-4" /> Báo lỗi
          </button>
        </div>
      </div>
      {reporting && current && (
        <ReportForm movieId={movie.id} linkId={current.linkId} serverLabel={current.label} onDone={() => setReporting(false)} />
      )}
    </div>
  );
}
