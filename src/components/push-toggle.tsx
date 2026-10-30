"use client";

import { Bell, BellOff, BellRing } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { sendTestPush } from "@/app/actions/push";
import { currentPushSubscription, disablePush, enablePush, getPushState, resyncPush, type PushState } from "@/lib/push-client";

const HINTS: Partial<Record<PushState, string>> = {
  ios: "Trên iPhone/iPad: bấm nút Chia sẻ → “Thêm vào MH chính”, mở web từ biểu tượng mới rồi bật thông báo tại đây.",
  denied: "Bạn đã chặn thông báo của web này. Bấm biểu tượng ổ khóa cạnh địa chỉ web → cho phép Thông báo, rồi tải lại trang.",
  unsupported: "Trình duyệt này chưa hỗ trợ thông báo. Hãy dùng Chrome, Edge, Firefox hoặc Safari bản mới.",
};

/** Thẻ bật/tắt thông báo tập mới cho thiết bị đang dùng (trang Phim yêu thích). */
export function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getPushState().then((next) => {
      if (cancelled) return;
      setState(next);
      if (next === "on") resyncPush();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state || state === "unavailable") return null;

  const enable = () =>
    startTransition(async () => {
      const result = await enablePush();
      setState(result === "ok" ? "on" : result === "denied" ? "denied" : "off");
      setMessage(
        result === "ok"
          ? "Đã bật. Bạn sẽ nhận thông báo khi phim yêu thích có tập mới."
          : result === "denied"
            ? null
            : "Chưa bật được thông báo, thử lại sau nhé.",
      );
    });
  const disable = () =>
    startTransition(async () => {
      await disablePush();
      setState("off");
      setMessage("Đã tắt thông báo trên thiết bị này.");
    });
  const test = () =>
    startTransition(async () => {
      const subscription = await currentPushSubscription();
      const result = subscription ? await sendTestPush(subscription.endpoint) : { ok: false };
      setMessage(result.ok ? "Đã gửi thông báo thử, hãy kiểm tra góc màn hình." : "Gửi thử không được. Hãy tắt rồi bật lại thông báo.");
    });

  return (
    <section className="mb-6 flex flex-col gap-3 rounded-2xl bg-surface/60 p-4 ring-1 ring-white/5 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
        {state === "on" ? <BellRing className="size-5" aria-hidden /> : <Bell className="size-5" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">
          Thông báo tập mới {state === "on" && <span className="font-normal text-ok">· đang bật</span>}
        </p>
        <p className="text-muted">{HINTS[state] ?? "Nhận thông báo trên thiết bị này khi phim bạn yêu thích có tập mới."}</p>
        {message && (
          <p className="mt-1 text-accent" role="status">
            {message}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {state === "off" && (
          <button type="button" onClick={enable} disabled={pending} className="btn btn-primary">
            <Bell className="size-4" aria-hidden /> Bật thông báo
          </button>
        )}
        {state === "on" && (
          <>
            <button type="button" onClick={test} disabled={pending} className="btn btn-ghost">
              Gửi thử
            </button>
            <button type="button" onClick={disable} disabled={pending} className="btn btn-ghost">
              <BellOff className="size-4" aria-hidden /> Tắt
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/** Nút nhỏ hiện cạnh "Đã yêu thích" khi thiết bị chưa bật thông báo. */
export function NewEpisodeAlert() {
  const [state, setState] = useState<PushState | null>(null);
  const [enabledNow, setEnabledNow] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getPushState().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "on" && enabledNow) {
    return (
      <span className="animate-scale-in flex items-center gap-1.5 text-sm text-ok" role="status">
        <BellRing className="size-4" aria-hidden /> Sẽ báo khi có tập mới
      </span>
    );
  }
  if (state !== "off") return null;
  return (
    <button
      type="button"
      disabled={pending}
      className="btn btn-ghost animate-scale-in"
      onClick={() =>
        startTransition(async () => {
          const result = await enablePush();
          setState(result === "ok" ? "on" : result === "denied" ? "denied" : "off");
          setEnabledNow(result === "ok");
        })
      }
    >
      <Bell className="size-4" aria-hidden /> Báo khi có tập mới
    </button>
  );
}
