import Bottleneck from "bottleneck";

/** User-Agent trung thực, có địa chỉ liên hệ — không giả trình duyệt. */
const USER_AGENT = `WebPhimSync/1.0 (+${process.env.SITE_URL ?? "http://localhost:3000"})`;

/** Số lỗi liên tiếp (429/5xx/mạng) trước khi coi như nguồn đang chặn hoặc sập. */
const FAILURE_THRESHOLD = 6;
const MAX_INTERVAL_MS = 30_000;

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
  ) {
    super(`HTTP ${status} khi gọi ${url}`);
  }
}

/**
 * Nguồn từ chối (403) hoặc lỗi liên tục: dừng gọi ngay, để tầng đồng bộ tạm dừng nguồn này một thời gian
 * thay vì tiếp tục gửi request (càng gửi càng dễ bị chặn lâu hơn).
 */
export class SourceBlockedError extends Error {
  constructor(
    public readonly sourceKey: string,
    message: string,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Client HTTP cho một nguồn:
 * - tuần tự, giãn cách tối thiểu `baseIntervalMs`; gặp 429 thì tự giãn thêm (tối đa 30s), ổn định thì nhanh dần lại
 * - lỗi mạng / 5xx: thử lại với backoff và chuyển sang domain dự phòng (mirror) nếu có
 * - 403 hoặc lỗi liên tiếp quá ngưỡng: ném SourceBlockedError
 */
export class SourceClient {
  private readonly limiter: Bottleneck;
  private interval: number;
  private successStreak = 0;
  private failureStreak = 0;
  private baseIndex = 0;

  constructor(
    readonly sourceKey: string,
    private readonly baseUrls: string[],
    private readonly baseIntervalMs: number,
    /** cho test thay bằng hàm không chờ */
    private readonly wait: (ms: number) => Promise<unknown> = sleep,
  ) {
    if (baseUrls.length === 0) throw new Error(`Nguồn ${sourceKey} chưa có baseUrl`);
    this.interval = baseIntervalMs;
    this.limiter = new Bottleneck({ maxConcurrent: 1, minTime: baseIntervalMs });
  }

  /** Domain đang dùng (có thể là mirror nếu domain chính lỗi). */
  get activeBaseUrl() {
    return this.baseUrls[this.baseIndex].replace(/\/+$/, "");
  }

  private setInterval(ms: number) {
    this.interval = Math.min(MAX_INTERVAL_MS, Math.max(this.baseIntervalMs, Math.round(ms)));
    this.limiter.updateSettings({ minTime: this.interval });
  }

  private recordSuccess() {
    this.failureStreak = 0;
    this.successStreak++;
    // Sau 20 lần thành công liên tiếp thì giảm dần khoảng giãn cách về mức gốc
    if (this.interval > this.baseIntervalMs && this.successStreak >= 20) {
      this.successStreak = 0;
      this.setInterval(this.interval * 0.75);
    }
  }

  private recordFailure(reason: string) {
    this.successStreak = 0;
    this.failureStreak++;
    if (this.failureStreak >= FAILURE_THRESHOLD) {
      throw new SourceBlockedError(this.sourceKey, `${this.sourceKey}: ${this.failureStreak} lỗi liên tiếp (${reason})`);
    }
  }

  private nextMirror() {
    if (this.baseUrls.length > 1) this.baseIndex = (this.baseIndex + 1) % this.baseUrls.length;
  }

  /** GET JSON theo đường dẫn tương đối. Trả null khi 404. */
  async getJson(path: string, retries = 3): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      const url = `${this.activeBaseUrl}${path}`;
      let res: Response | null = null;
      try {
        res = await this.limiter.schedule(() =>
          fetch(url, {
            headers: { "user-agent": USER_AGENT, accept: "application/json" },
            signal: AbortSignal.timeout(20_000),
          }),
        );
      } catch (error) {
        // Lỗi mạng / DNS / timeout: domain có thể đã chết → thử mirror
        this.recordFailure(error instanceof Error ? error.message : "lỗi mạng");
        this.nextMirror();
        if (attempt >= retries) throw error;
        await this.wait(1000 * 2 ** attempt);
        continue;
      }

      if (res.ok) {
        try {
          const json = await res.json();
          this.recordSuccess();
          return json;
        } catch {
          // Trả về HTML (trang lỗi / trang chặn) thay vì JSON
          this.recordFailure("phản hồi không phải JSON");
          if (attempt >= retries) throw new HttpError(res.status, url);
          await this.wait(1000 * 2 ** attempt);
          continue;
        }
      }
      if (res.status === 404) {
        this.failureStreak = 0;
        return null;
      }
      if (res.status === 401 || res.status === 403) {
        throw new SourceBlockedError(this.sourceKey, `${this.sourceKey} từ chối truy cập (HTTP ${res.status})`);
      }
      if (res.status === 429) {
        // Bị giới hạn tốc độ: giãn cách gấp đôi cho mọi request sau, chờ theo Retry-After
        this.setInterval(this.interval * 2);
        this.recordFailure("HTTP 429");
        if (attempt >= retries) throw new HttpError(429, url);
        const retryAfter = Number(res.headers.get("retry-after"));
        await this.wait(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 120) * 1000 : this.interval * 2);
        continue;
      }
      if (res.status >= 500) {
        this.recordFailure(`HTTP ${res.status}`);
        this.nextMirror();
        if (attempt >= retries) throw new HttpError(res.status, url);
        await this.wait(1000 * 2 ** attempt);
        continue;
      }
      throw new HttpError(res.status, url);
    }
  }
}
