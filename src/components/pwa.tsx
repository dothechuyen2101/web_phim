"use client";

import { Download, Share, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { isIOS, isStandalone, registerServiceWorker } from "@/lib/push-client";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
/** prompt: trình duyệt cho cài trực tiếp (Chrome/Edge/Android) · ios: phải tự "Thêm vào MH chính" */
type InstallMode = "prompt" | "ios" | null;

const VISITS_KEY = "phim:visits";
const DISMISSED_KEY = "phim:install-dismissed";
const DISMISS_DAYS = 14;

// Sự kiện có thể bắn trước khi React chạy xong, nên bắt ngay khi tải module
let installEvent: InstallEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // dùng gợi ý của web thay cho thanh mặc định của trình duyệt
    installEvent = event as InstallEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installEvent = null;
    emit();
  });
}

function installMode(): InstallMode {
  if (isStandalone()) return null;
  if (installEvent) return "prompt";
  return isIOS() ? "ios" : null;
}

/** Banner chỉ hiện từ lần ghé thứ hai và không hiện lại trong DISMISS_DAYS ngày sau khi bấm đóng. */
function bannerMode(): InstallMode {
  const mode = installMode();
  if (!mode) return null;
  try {
    const visits = Number(localStorage.getItem(VISITS_KEY) ?? 0);
    const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) ?? 0);
    return visits >= 2 && Date.now() - dismissedAt > DISMISS_DAYS * 86_400_000 ? mode : null;
  } catch {
    return null;
  }
}

async function promptInstall() {
  const event = installEvent;
  if (!event) return;
  await event.prompt();
  await event.userChoice.catch(() => null);
  installEvent = null; // mỗi sự kiện chỉ gọi prompt() được một lần
  emit();
}

function dismissBanner() {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // bỏ qua
  }
  emit();
}

/** Đăng ký service worker (nhận thông báo, đủ điều kiện cài app) + gợi ý cài app trên điện thoại. */
export function PwaPrompt({ siteName }: { siteName: string }) {
  const mode = useSyncExternalStore(subscribe, bannerMode, () => null);

  useEffect(() => {
    try {
      // Mỗi phiên trình duyệt tính là một lần ghé
      if (!sessionStorage.getItem(VISITS_KEY)) {
        sessionStorage.setItem(VISITS_KEY, "1");
        localStorage.setItem(VISITS_KEY, String(Number(localStorage.getItem(VISITS_KEY) ?? 0) + 1));
        emit();
      }
    } catch {
      // storage bị chặn: không gợi ý cài
    }
    if (!("serviceWorker" in navigator)) return;
    const register = () => void registerServiceWorker().catch(() => {});
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  if (!mode) return null;
  return (
    <div
      role="dialog"
      aria-label="Cài ứng dụng"
      className="animate-fade-up fixed inset-x-3 bottom-[5.5rem] z-40 flex items-center gap-3 rounded-2xl bg-surface-2/95 p-3 shadow-2xl shadow-black/70 ring-1 ring-white/10 backdrop-blur-xl md:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <Image src="/icons/icon-192.png" alt="" width={40} height={40} className="size-10 rounded-xl" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Cài {siteName} lên điện thoại</p>
        <p className="text-xs text-muted">
          {mode === "ios" ? (
            <>
              Bấm <Share className="inline size-3.5 align-[-2px]" aria-label="Chia sẻ" /> rồi chọn “Thêm vào MH chính”
            </>
          ) : (
            "Mở nhanh như app, nhận thông báo tập mới"
          )}
        </p>
      </div>
      {mode === "prompt" && (
        <button type="button" onClick={promptInstall} className="btn btn-primary">
          Cài
        </button>
      )}
      <button type="button" aria-label="Đóng" onClick={dismissBanner} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:text-fg">
        <X className="size-4" />
      </button>
    </div>
  );
}

/** Nút "Cài ứng dụng" ở chân trang (mọi kích thước màn hình). */
export function InstallButton() {
  const mode = useSyncExternalStore(subscribe, installMode, () => null);
  const [help, setHelp] = useState(false);
  if (!mode) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => (mode === "prompt" ? promptInstall() : setHelp((open) => !open))}
        className="flex items-center gap-1.5 text-left transition-colors hover:text-accent"
      >
        <Download className="size-4" aria-hidden /> Cài ứng dụng
      </button>
      {help && (
        <span className="text-xs">
          Bấm <Share className="inline size-3.5 align-[-2px]" aria-label="Chia sẻ" /> rồi chọn “Thêm vào MH chính”.
        </span>
      )}
    </>
  );
}
