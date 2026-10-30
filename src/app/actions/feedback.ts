"use server";

import { createHash } from "node:crypto";
import { updateTag } from "next/cache";
import { z } from "zod";
import { enqueueSync } from "@/ingest/jobs";
import { applyReportThreshold } from "@/ingest/links";
import { db } from "@/lib/db";
import { movieTag } from "@/lib/queries";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { REPORT_REASONS } from "@/lib/site";
import type { FormState } from "./auth";

/** Băm IP (kèm secret) để đếm số người báo lỗi khác nhau mà không lưu IP thật. */
async function reporterHash() {
  return createHash("sha256")
    .update(`${await clientIp()}|${process.env.AUTH_SECRET ?? ""}`)
    .digest("base64url")
    .slice(0, 24);
}

/**
 * Lưu báo lỗi rồi kích hoạt cơ chế dự phòng:
 * - link có m3u8 gốc: xếp job kiểm tra ngay (chết thật thì tự đánh dấu hỏng)
 * - đủ số người khác nhau báo trong 24h: đánh dấu hỏng luôn
 * - tập không còn link nào xem được: xếp job tìm nguồn thay thế
 */
async function fileReport(movieId: number, linkId: number | null, reason: string) {
  const link = linkId
    ? await db.episodeLink.findFirst({
        where: { id: linkId, episode: { movieId } },
        select: { id: true, streamUrl: true, episode: { select: { movie: { select: { slug: true } } } } },
      })
    : null;
  await db.report.create({
    data: { movieId, episodeLinkId: link?.id ?? null, reason, reporterHash: await reporterHash() },
  });
  if (!link) return;

  try {
    if (link.streamUrl) await enqueueSync({ source: "all", mode: "check-links", linkIds: [link.id] });
    const broken = await applyReportThreshold(link.id);
    if (broken) {
      updateTag(movieTag(link.episode.movie.slug));
      for (const id of broken.movieIds) await enqueueSync({ source: "all", mode: "rescue", movieId: id });
    }
  } catch (error) {
    // Hàng đợi lỗi không được làm hỏng việc ghi nhận báo lỗi
    console.error("Không xếp được job dự phòng:", error);
  }
}

const reportSchema = z.object({
  movieId: z.coerce.number().int().positive(),
  linkId: z.coerce.number().int().positive().optional(),
  reason: z.enum(Object.keys(REPORT_REASONS) as [keyof typeof REPORT_REASONS]),
  note: z.string().trim().max(300).optional(),
});

export async function reportLink(_: FormState, formData: FormData): Promise<FormState> {
  if (!(await rateLimit("report", 5, 10 * 60_000))) return { error: "Bạn gửi báo lỗi quá nhanh, thử lại sau ít phút." };
  const parsed = reportSchema.safeParse({
    movieId: formData.get("movieId"),
    linkId: formData.get("linkId") || undefined,
    reason: formData.get("reason"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "Thông tin báo lỗi không hợp lệ." };

  const { movieId, linkId, reason, note } = parsed.data;
  await fileReport(movieId, linkId ?? null, note ? `${REPORT_REASONS[reason]}: ${note}` : REPORT_REASONS[reason]);
  return { message: "Cảm ơn bạn! Hệ thống sẽ tự kiểm tra và tìm nguồn khác nếu link đã chết." };
}

/** Người xem bấm "Lỗi phát? Đổi server": ghi nhận nhẹ cho server vừa bỏ. */
export async function reportPlaybackIssue(movieId: number, linkId: number) {
  if (!Number.isInteger(movieId) || !Number.isInteger(linkId)) return;
  if (!(await rateLimit("playback-issue", 10, 10 * 60_000))) return;
  await fileReport(movieId, linkId, `${REPORT_REASONS["khong-phat"]} (người xem đổi server)`);
}

/** Tập/phim không còn server nào xem được: nhờ worker tìm nguồn thay thế (có thời gian chờ giữa các lần). */
export async function requestRescue(movieId: number): Promise<{ queued: boolean }> {
  if (!Number.isInteger(movieId)) return { queued: false };
  if (!(await rateLimit("rescue", 5, 10 * 60_000))) return { queued: false };
  if (!(await db.movie.findUnique({ where: { id: movieId }, select: { id: true } }))) return { queued: false };
  try {
    await enqueueSync({ source: "all", mode: "rescue", movieId });
    return { queued: true };
  } catch {
    return { queued: false };
  }
}

const takedownSchema = z.object({
  contactName: z.string().trim().min(2, "Vui lòng nhập họ tên / tổ chức").max(120),
  contactEmail: z.email("Email không hợp lệ").max(200),
  urls: z.string().trim().min(5, "Vui lòng nhập đường dẫn nội dung cần gỡ").max(5000),
  message: z.string().trim().min(10, "Vui lòng mô tả ngắn gọn yêu cầu").max(5000),
});

export async function submitTakedown(_: FormState, formData: FormData): Promise<FormState> {
  if (!(await rateLimit("takedown", 3, 60 * 60_000))) return { error: "Bạn đã gửi nhiều yêu cầu, vui lòng thử lại sau." };
  const parsed = takedownSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Thông tin không hợp lệ." };
  await db.takedownRequest.create({ data: parsed.data });
  return { message: "Đã nhận yêu cầu. Chúng tôi sẽ xử lý và phản hồi qua email trong thời gian sớm nhất." };
}
