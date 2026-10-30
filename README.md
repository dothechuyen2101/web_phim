# Web Phim

Web xem phim tổng hợp (phim lẻ, phim bộ, hoạt hình, anime, TV show). Dữ liệu được đồng bộ tự động từ các API phim công khai. Web **không lưu và không phát lại video**: chỉ lưu metadata và link nhúng, khi xem thì nhúng iframe player của nguồn.

- **Next.js 16** (App Router, Cache Components) + Tailwind CSS 4
- **PostgreSQL trên Supabase** + Prisma 7, tìm kiếm không dấu bằng `pg_trgm`
- **Worker** đồng bộ dữ liệu riêng, xếp lịch bằng `pg-boss` (chạy trên Postgres, không cần Redis). Trên Vercel không có worker, thay bằng "tick" do Supabase pg_cron gọi mỗi 30 phút
- Triển khai được lên **Vercel (gói Hobby miễn phí)** hoặc **VPS bằng Docker**
- Đăng nhập bằng email/mật khẩu (scrypt + cookie JWT), có trang quản trị
- Trang **Tập mới hôm nay** (`/tap-moi`), **thông báo tập mới** cho phim yêu thích (Web Push), cài được lên điện thoại như app (**PWA**)

## Nguồn dữ liệu

| Nguồn | Vai trò | Ghi chú |
|---|---|---|
| KKPhim (`phimapi.com`) | Nguồn chính (ưu tiên 10) | Player nhúng được trên domain khác; đã kiểm chứng phát được |
| NguonC (`phim.nguonc.com/api`) | Nguồn phụ (ưu tiên 5), thêm server dự phòng | Có thêm script "stream-guard" phía client; xem [Lưu ý vận hành](#lưu-ý-vận-hành) |
| VSMov (`vsmov.com/api`) | Nguồn phụ (ưu tiên 3), thêm server và phim hai nguồn kia thiếu | Player cho nhúng mọi domain (`frame-ancestors *`); chỉ có link nhúng; với hoạt hình Trung Quốc chậm hơn KKPhim |

**Các nguồn đã khảo sát nhưng không dùng (30/10/2026):**
- **Trang chuyên hoạt hình Trung Quốc** (hoathinh3d, hhninja, hhtq, hhkungfu, yanhh3d, hh3dsub, hoathinh4k8): ra tập mới sớm nhất, nhưng đều khóa việc phát từ domain khác, bằng CSP `frame-ancestors` chỉ cho phép domain của họ, kiểm tra Referer, không bật CORS, hoặc mã hóa playlist. Dùng chúng là phải lách các cơ chế đó, nên web không dùng.
- **Các "API phim" khác** (OPhim, apii.online…): đã chết, hoặc là nguồn phim người lớn.

Phim có mặt ở nhiều nguồn được gộp lại theo thứ tự:
1. Mã TMDB `(loại, id, season)`.
2. IMDb (chỉ áp dụng cho phim lẻ).
3. Tên gốc + năm + loại.

Một số nguồn (VSMov, đôi khi cả NguonC) không ghi số mùa TMDB của phim bộ. Khi đó web chỉ gộp với bản có số mùa nếu bộ đó chỉ có đúng một mùa, hoặc đúng một mùa cùng năm. Không chắc thì để thành phim riêng, không gộp nhầm mùa.

Nguồn có độ ưu tiên cao quyết định metadata; nguồn phụ chỉ điền chỗ trống và thêm server. Phim thể loại `phim-18` không được đồng bộ.

hoathinh3d.ee **không được dùng**: host video của trang này chặn mọi domain khác (kiểm tra Referer), và web không giả mạo Referer hay proxy luồng video.

> Phần lớn nội dung từ các nguồn này không có bản quyền. Web có trang `/gui-yeu-cau-go` và công cụ ẩn phim trong admin để xử lý yêu cầu gỡ nhanh.

## Chạy ở máy dev

Yêu cầu: Node 22 và một project Supabase. Muốn dùng Postgres local thay vì Supabase thì cần thêm Docker.

```bash
npm install                      # postinstall tự chạy prisma generate
cp .env.example .env             # điền DATABASE_URL (Supabase), AUTH_SECRET, REVALIDATE_SECRET
npx prisma migrate deploy
npm run sync -- --mode taxonomy  # thể loại, quốc gia
npm run sync -- --pages 3        # vài trang phim mới nhất để có dữ liệu
npm run create-admin -- --email ban@example.com --password "mat-khau-dai"
npm run dev:all                  # web http://localhost:3100 + worker đồng bộ tự động
```

### Supabase

- **Kết nối qua pooler Supavisor.** Host trực tiếp `db.<ref>.supabase.co` chỉ có IPv6, nhiều mạng và VPS không kết nối được. Lấy chuỗi kết nối ở Dashboard → Connect. User có dạng `postgres.<project-ref>`.
  - *Session pooler*, cổng 5432: máy dev, VPS, worker, `prisma migrate`.
  - *Transaction pooler*, cổng 6543: Vercel (mỗi request serverless mượn kết nối trong thời gian ngắn). Khi đó đặt thêm `DIRECT_URL` (session, 5432) cho Prisma CLI và các script.
- **Mã hóa ký tự đặc biệt trong mật khẩu** theo chuẩn URL, ví dụ `@` → `%40`.
- **TLS được xác thực đầy đủ:** `sslmode=verify-full&sslrootcert=certs/supabase-ca.crt`. File này là CA chính thức "Supabase Root 2021 CA". Prisma CLI dùng tên tham số khác (`sslcert`), và `prisma.config.ts` tự chuyển đổi, nên chỉ cần một `DATABASE_URL`.
- **Giới hạn kết nối:** pooler chỉ cho khoảng 15 kết nối đồng thời tới Postgres. Mỗi tiến trình dùng tối đa `DB_POOL_MAX` (mặc định 5; trên Vercel nên đặt 3); pg-boss dùng 3 ở worker và 1 ở web/tick.
- **Khóa Data API:** Supabase tự công khai schema `public` qua Data API (REST) cho role `anon`. Migration `supabase_lockdown` bật RLS cho mọi bảng và thu hồi quyền của `anon`/`authenticated`. Web kết nối bằng role sở hữu bảng nên không bị ảnh hưởng. **Bảng mới thêm sau này cũng phải bật RLS**, bằng cách thêm `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` vào migration của bảng đó.
- **Vị trí server:** project hiện đặt ở `ap-northeast-1` (Tokyo). Function trên Vercel được đặt ở `hnd1` (Tokyo, trong `vercel.json`) để cạnh DB. Đổi vùng của DB thì đổi `regions` cho khớp, ví dụ `ap-southeast-1` ↔ `sin1` (Singapore).

`npm run dev:all` chạy cả web lẫn **worker**. **Thiếu worker thì phim không tự cập nhật**: không có đồng bộ mỗi 5 phút, không kiểm tra link, các nút trong admin cũng không chạy. Chỉ cần web thì dùng `npm run dev`. Cổng dev cố định là 3100, vì máy này đã dùng cổng 3000/3001 cho dự án khác; `WEB_INTERNAL_URL` trong `.env` phải trỏ đúng cổng này để worker báo web làm mới cache.

## Các lệnh

| Lệnh | Việc |
|---|---|
| `npm run dev` / `build` / `start` | Web Next.js |
| `npm run dev:all` | Web (cổng 3100) + worker cùng lúc — dùng khi phát triển |
| `npm run worker` | Worker: đồng bộ tăng dần khi khởi động và mỗi 5 phút, kiểm tra link mỗi giờ, thể loại lúc 3h sáng, xử lý job từ admin |
| `npm run sync -- [--source kkphim\|nguonc\|all] [--mode incremental\|backfill\|taxonomy] [--pages N] [--restart] [--slug X]` | Đồng bộ thủ công, không cần worker |
| `npm run sync -- --mode check-links [--pages N]` | Kiểm tra N link (m3u8 gốc) còn sống không |
| `npm run sync -- --mode rescue --movie-id N` | Tìm nguồn thay thế cho một phim ngay |
| `npm run sync -- --mode notify` | Gửi thông báo tập mới ngay (bình thường tick / worker tự gửi) |
| `npm run enqueue -- --source kkphim --mode backfill` | Gửi job cho worker đang chạy |
| `npm run merge-duplicates [-- --apply]` | Tìm và gộp phim bộ bị trùng (bản không ghi số mùa TMDB nằm cạnh bản có mùa) |
| `npm run create-admin -- --email ... --password ...` | Tạo admin, hoặc cấp quyền admin cho tài khoản đã có |
| `npm run setup-cron -- --url https://... [--remove]` | (Vercel) Lập lịch Supabase pg_cron gọi `/api/cron/tick` (mặc định mỗi 30 phút, đổi bằng `--schedule "*/15 * * * *"`) |
| `npx tsx scripts/generate-icons.ts` | Vẽ lại icon PWA, favicon, apple-icon từ logo |
| `npm test` | Unit test (chuẩn hóa dữ liệu, adapter trên dữ liệu mẫu thật) |
| `npm run lint` / `npm run typecheck` | Kiểm tra code |

**Các chế độ đồng bộ:**
- `incremental`: duyệt danh sách "mới cập nhật" từ trang 1 và dừng ngay khi gặp một trang không có gì thay đổi. Chỉ gọi API chi tiết cho phim thực sự đổi.
- `backfill`: lấy toàn bộ kho, khoảng 1.300 trang ở KKPhim và 3.400 trang ở NguonC. Con trỏ trang được lưu lại nên có thể chạy tiếp nếu bị dừng. Worker chia thành từng đợt 100 trang. Toàn bộ kho mất vài giờ, vì tốc độ gọi bị giới hạn ở khoảng 2 req/s với KKPhim và 1 req/s với NguonC.

## Dự phòng khi link chết & khi nguồn gặp sự cố

**Phía người xem (trang xem phim):**
- **Nhiều server cho mỗi tập**, gồm:
  - player nhúng của từng nguồn;
  - **server "Dự phòng"**: phát thẳng luồng m3u8 gốc bằng player của web (hls.js). Cách này chỉ dùng khi máy chủ video của nguồn cho phép phát cross-origin (KKPhim trả `Access-Control-Allow-Origin: *`).
- **Khi trang player của nguồn bị lỗi** (ví dụ player KKPhim kẹt ở "Đang tải…"), server dự phòng vẫn phát được.
- **Server dự phòng tự chuyển** sang server kế tiếp nếu luồng lỗi nghiêm trọng.
- **Player nhúng** (iframe khác domain, web không đọc được lỗi bên trong):
  - Có lớp chờ tải.
  - Quá 15 giây chưa tải xong thì gợi ý "Thử server khác".
  - Có nút **"Lỗi phát? Đổi server"** để chuyển ngay, đồng thời ghi nhận lỗi.
- **Tập không còn server nào xem được:** trang hiện thông báo và tự nhờ worker tìm nguồn thay thế.
- **Ảnh lỗi hoặc thiếu:** hiện khung dự phòng có tên phim.

**Phía hệ thống (worker):**
- **Kiểm tra link mỗi giờ:**
  - Đọc thử playlist m3u8 gốc, ưu tiên phim được xem nhiều.
  - Hai lần liên tiếp thấy chết (404 hoặc không phải playlist) thì đánh dấu hỏng. Lỗi mạng hay timeout thì chưa kết luận.
  - Link chỉ có trang nhúng (không có m3u8) không được dò tự động, vì các host nhúng có WAF và dễ chặn IP máy chủ. Loại này dựa vào báo lỗi.
- **Báo lỗi tự động hóa:**
  - Mỗi báo lỗi kích hoạt một lần kiểm tra link ngay.
  - **3 người khác nhau** báo cùng một link trong 24 giờ thì tự đánh dấu hỏng. Hệ thống đếm bằng dấu băm IP, không lưu IP thật.
- **Tìm nguồn thay thế** (khi một tập không còn link xem được), mỗi phim tối đa một lần mỗi 6 giờ:
  1. Lấy lại phim từ nguồn đang liên kết, vì nguồn hay thay link mới.
  2. Tìm ở các nguồn khác: theo mã TMDB (KKPhim hỗ trợ tra trực tiếp), hoặc theo tên gốc. Chỉ ghép khi khớp TMDB, hoặc khớp cả tên gốc lẫn năm.

**Để không bị nguồn chặn, crawler chạy "lịch sự":**
- User-Agent trung thực, gọi tuần tự, mỗi nguồn có giới hạn tốc độ riêng.
- Chỉ lấy chi tiết những phim có thay đổi.
- Gặp `429` thì tự giãn cách gấp đôi (tối đa 30 giây) và tôn trọng `Retry-After`. Ổn định trở lại thì nhanh dần.
- Gặp `403`, hoặc lỗi liên tiếp, hoặc nguồn trả trang HTML thay vì JSON:
  - Dừng ngay, không gửi tiếp.
  - **Tạm dừng nguồn** 15 phút → 30 phút → 1 giờ… tối đa 6 giờ (circuit breaker), rồi tự thử lại.
  - Admin xem lý do và có thể "Mở lại ngay".
- **Domain dự phòng (mirror):** khi domain chính lỗi mạng hoặc 5xx, crawler tự chuyển sang mirror. Danh sách mirror khai báo trong `/admin/nguon`.
- Web **không** giả mạo Referer hay User-Agent, **không** xoay vòng proxy và **không** vượt Cloudflare hoặc cơ chế chống nhúng của nguồn. Làm vậy là vượt kiểm soát truy cập của bên khác, và thường dẫn tới bị chặn lâu hơn.

## Giao diện

- **Phong cách:** nền tối có quầng sáng "aurora", bề mặt kính mờ, điểm nhấn gradient hổ phách → san hô, font Be Vietnam Pro.
- **Hero carousel ở trang chủ:**
  - Ảnh nền có hiệu ứng Ken Burns, chuyển slide bằng crossfade.
  - Thanh tiến trình tự chuyển slide, dừng khi rê chuột.
  - Vuốt được trên mobile, điều khiển bằng phím mũi tên.
- **Hiệu ứng chuyển động:**
  - Thẻ phim xuất hiện lần lượt, khi rê chuột thì nổi lên kèm nút play. Hàng phim cuộn ngang có nút mũi tên.
  - Header trong suốt ở đầu trang, chuyển sang kính mờ khi cuộn.
  - Skeleton có vệt sáng chạy ngang, chuyển sang nội dung bằng View Transitions.
  - Bấm "Tập tiếp" hoặc "Tập trước" thì nội dung trượt theo hướng tương ứng.
- **Mobile:** thanh điều hướng dưới cùng, nút lên đầu trang.
- **Giảm chuyển động:** tôn trọng `prefers-reduced-motion`. Khi người dùng bật chế độ này, hiệu ứng tắt và hero không tự chạy.

## Cấu trúc

```
src/sources/      adapter từng nguồn + chuẩn hóa (normalize.ts) — thêm nguồn mới ở đây
src/ingest/       gộp phim (upsert.ts), đồng bộ (sync.ts), hàng đợi job (jobs.ts)
src/lib/          db, truy vấn có cache (queries.ts), xác thực, tiện ích
src/app/          các trang; actions/ là Server Actions; admin/ là trang quản trị
worker/index.ts   tiến trình worker
scripts/          CLI sync, enqueue, create-admin
tests/            unit test + fixtures JSON lấy từ API thật
```

**Thêm nguồn mới:**
1. Viết một class hiện thực `SourceAdapter` (`src/sources/types.ts`), trả về `NormalizedMovie`.
2. Đăng ký class đó trong `createAdapter` và `DEFAULT_SOURCES` (`src/sources/index.ts`).
3. Thêm domain player của nguồn vào `EMBED_HOSTS`.
4. Lưu một vài JSON thật vào `tests/fixtures/` và viết test.

## Tập mới, thông báo và PWA

- **`/tap-moi`**: các tập được thêm trong ngày (giờ Việt Nam), gom theo phim, xem lại được 7 ngày. Trang chủ có hàng "Tập mới hôm nay". "Tập mới" là tập web thêm vào **sau khi phim đã có trên web**; lúc nhập nguyên bộ phim mới thì không tính (cột `Episode.createdAt`).
- **Thông báo tập mới (Web Push, miễn phí):** người dùng bấm "Yêu thích" rồi "Báo khi có tập mới" (hoặc bật ở trang Phim yêu thích). Mỗi lượt tick / worker, sau khi đồng bộ, web gửi thông báo cho tập mới của phim họ yêu thích: mỗi phim một thông báo, nhiều hơn 3 phim thì gộp lại. Thiết bị đã hủy đăng ký được tự xóa.
  - Cần cặp khóa VAPID: `npx web-push generate-vapid-keys` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY` và `VAPID_PRIVATE_KEY` (đặt ở `.env` và trên Vercel, rồi build lại vì khóa công khai được nhúng lúc build). **Đổi khóa thì mọi thiết bị phải bật lại thông báo.**
  - Tùy chọn `VAPID_SUBJECT` (`mailto:...` hoặc `https://...`), mặc định là `SITE_URL`.
  - iPhone/iPad chỉ nhận được thông báo khi web đã được **thêm vào màn hình chính** (iOS 16.4 trở lên); web tự hướng dẫn việc này.
- **PWA:** `app/manifest.ts`, icon trong `public/icons` (vẽ bằng `scripts/generate-icons.ts`), service worker `public/sw.js` chỉ dùng cho thông báo, không cache trang. Trên điện thoại, từ lần ghé thứ hai web gợi ý cài app (đóng thì 14 ngày sau mới gợi ý lại); chân trang có nút "Cài ứng dụng".
- **SEO:** trang danh sách không lọc có canonical trỏ về chính nó (giữ `?trang=N`); trang đang lọc / sắp xếp gắn `noindex, follow` để các tổ hợp bộ lọc không bị coi là trang trùng.

## Cache

Dữ liệu công khai được cache bằng `"use cache"` với hai loại tag:
- `movies`: các danh sách.
- `movie:<slug>`: trang chi tiết và trang xem.

Sau mỗi lần đồng bộ, worker gọi `POST /api/revalidate` (có secret), nên web cập nhật ngay mà không phải chờ hết hạn cache. Thao tác trong admin (ẩn phim, sửa, bật/tắt nguồn) cũng làm mới cache ngay.

`next build` **không cần kết nối DB**: mọi truy vấn chạy lúc request (sau `connection()` hoặc sau khi đọc params).

## Triển khai lên Vercel (gói Hobby miễn phí)

Vercel không có tiến trình chạy liên tục, nên **không có worker**. Việc đồng bộ chạy theo từng "tick":
- **Supabase pg_cron + pg_net** gửi `POST /api/cron/tick` mỗi 30 phút (kèm `Authorization: Bearer <CRON_SECRET>`). Gói Hobby của Vercel chỉ cho Cron chạy **1 lần/ngày**, không đủ cho việc này.
- Route trả `202` ngay, rồi chạy tiếp tối đa ~4 phút (giới hạn function là 300 giây):
  1. Đồng bộ tăng dần (tối đa 5 trang mỗi nguồn).
  2. Xử lý job trong hàng đợi: nút trong admin, tìm nguồn thay thế khi link chết, backfill (mỗi job 2 trang).
  3. Kiểm tra link mỗi giờ, cập nhật thể loại mỗi ngày.
  4. Báo web làm mới cache.
- Bảng `CronState` giữ khóa, nên hai tick không bao giờ chạy chồng nhau.
- Vercel Cron trong `vercel.json` (20:00 UTC = 3h sáng giờ VN) là lưới an toàn, phòng khi pg_cron gặp sự cố.

**Các bước:**

1. Đẩy code lên GitHub. Trên vercel.com chọn **Add New → Project**, import repo. Vercel tự nhận Next.js; không cần sửa lệnh build.
2. Khai báo **Environment Variables** trước khi bấm Deploy:

   | Biến | Giá trị |
   |---|---|
   | `DATABASE_URL` | **Transaction pooler, cổng 6543**: `postgresql://postgres.<ref>:<mat-khau>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=verify-full&sslrootcert=certs/supabase-ca.crt` |
   | `DB_POOL_MAX` | `3` |
   | `AUTH_SECRET`, `REVALIDATE_SECRET`, `CRON_SECRET` | Chuỗi ngẫu nhiên. `CRON_SECRET` phải **trùng** với giá trị trong `.env` ở máy bạn (dùng cho bước 4) |
   | `SITE_NAME` | Tên web |
   | `SITE_URL` | Tùy chọn. Bỏ trống thì dùng domain `*.vercel.app`. Khi gắn domain riêng thì đặt biến này rồi **Redeploy** |
   | `EMBED_HOSTS` | Tùy chọn, như bản VPS |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Khóa Web Push cho thông báo tập mới (xem mục bên dưới). Thiếu thì tính năng tự ẩn |

   Không cần `WEB_INTERNAL_URL` hay `DIRECT_URL` trên Vercel. File CA `certs/supabase-ca.crt` đã được kèm vào function (`outputFileTracingIncludes` trong `next.config.ts`).
3. **Migration chạy từ máy bạn**, không chạy trong lúc Vercel build (build không cần DB): `npx prisma migrate deploy`. Lệnh này dùng `DIRECT_URL` (hoặc `DATABASE_URL`) session mode trong `.env` ở máy.
4. Sau khi deploy xong và đã có địa chỉ web, **lập lịch tick** từ máy:
   ```bash
   npm run setup-cron -- --url https://<ten-du-an>.vercel.app
   ```
   Kiểm tra trong Supabase → SQL Editor:
   - `select status, start_time from cron.job_run_details order by start_time desc limit 5;`
   - `select status_code, created from net._http_response order by created desc limit 5;` (phải là `202`)

   Trên Vercel, mục **Logs** hiện dòng `[tick] ...` sau mỗi lần chạy.
5. Tạo admin từ máy: `npm run create-admin -- --email ... --password ...` (ghi thẳng vào Supabase).

**Lưu ý:**
- **Lấy toàn bộ kho phim:** mỗi tick chỉ có vài phút, nên backfill khoảng 4.700 trang qua tick sẽ mất nhiều ngày. Hãy chạy từ máy: `npm run sync -- --mode backfill` (dừng giữa chừng thì chạy lại, nó tiếp tục từ con trỏ đã lưu).
- **Gói Hobby chỉ dùng cho mục đích phi thương mại**: không quảng cáo, không thu phí. Theo dõi hạn mức ở mục **Usage** của dashboard. Tick mỗi 30 phút là khoảng 1.500 lượt gọi/tháng, phần lớn thời gian chỉ chờ mạng.
- **Tập mới tới web chậm nhất khoảng 30 phút**, và job xếp từ admin (nút đồng bộ, backfill) hay từ việc tìm nguồn thay thế cũng phải chờ tới lần tick kế tiếp. Muốn nhanh hơn thì chạy lại `setup-cron` với `--schedule` dày hơn. Đo ngày 30/10, KKPhim có nhiều nhất khoảng 20 phim đổi trong 30 phút, nằm gọn trong giới hạn 5 trang mỗi nguồn mỗi tick.
- **Rủi ro bị gỡ project:** Vercel có thể gỡ project khi nhận khiếu nại bản quyền. Hãy xử lý `/admin/yeu-cau-go` nhanh.
- **Gỡ lịch tick:** `npm run setup-cron -- --remove`.
- **Đổi `CRON_SECRET`:** sửa trên Vercel và trong `.env`, Redeploy, rồi chạy lại `setup-cron`.

## Triển khai lên VPS

Cần một VPS Linux có Docker và một domain có bản ghi A trỏ về VPS.

```bash
cp .env.production.example .env.production   # sửa DOMAIN, DATABASE_URL (Supabase), AUTH_SECRET, REVALIDATE_SECRET
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production exec worker \
  npx tsx scripts/create-admin.ts --email ban@example.com --password "mat-khau-dai"
```

Stack gồm các thành phần sau (DB là Supabase nên không có Postgres trong compose):
- `migrate`: chạy `prisma migrate deploy` lên Supabase mỗi lần deploy rồi thoát.
- `web`: Next.js standalone.
- `worker`.
- `caddy`: tự cấp HTTPS cho `DOMAIN`.

Sau khi lên, vào `/admin/nguon` và bấm **Cập nhật thể loại**, rồi **Backfill toàn bộ kho** để lấy hết phim.

`SITE_URL`, `SITE_NAME` và `EMBED_HOSTS` được nhúng vào lúc build. Đổi các giá trị này thì phải build lại: `up -d --build`.

**Sao lưu DB:** gói Free của Supabase không có backup tự động có thể khôi phục. Nên đặt cron chạy `pg_dump` hằng ngày (cần PostgreSQL 17 client):

```bash
PGSSLMODE=verify-full PGSSLROOTCERT=certs/supabase-ca.crt \
  pg_dump "postgresql://postgres.<ref>:<mat-khau>@aws-0-<region>.pooler.supabase.com:5432/postgres" \
  --schema=public -Fc > backup-$(date +%F).dump
```

### Mạng có phần mềm kiểm tra TLS

Antivirus như Kaspersky, hoặc proxy công ty, có thể ký lại chứng chỉ HTTPS. Khi đó build Docker báo lỗi `SELF_SIGNED_CERT_IN_CHAIN`. Cách xử lý mà không phải tắt kiểm tra SSL:
- **Lúc build:** truyền root CA đó vào bằng `docker build --secret id=extra_ca,src=ca.pem ...`.
- **Lúc chạy:** đặt `NODE_EXTRA_CA_CERTS` trỏ tới file CA đã mount vào container.

VPS bình thường không cần bước này.

## Lưu ý vận hành

- **Domain của các API phim hay thay đổi.** OPhim đã ngừng hoạt động ở mọi domain. Nếu một nguồn đổi domain, sửa Base URL trong `/admin/nguon`.
- **Tắt một nguồn** trong admin sẽ ẩn ngay các server của nguồn đó khỏi trang xem.
- **NguonC:**
  - Player chặn trình duyệt tự động (User-Agent "HeadlessChrome"). Trang embed còn có script "stream-guard": trong lúc kiểm thử tự động, script này chuyển iframe về `phim.nguonc.com` (CSP của web chặn lượt chuyển đó). Chưa xác định được guard này có ảnh hưởng người xem thật hay không, nên hãy tự thử bằng trình duyệt thường.
  - Nếu NguonC không phát được, tắt nguồn này trong admin. KKPhim vẫn là server mặc định.
  - Cloudflare của streamc.xyz có thể tạm chặn IP nếu gửi nhiều request thử nghiệm.
- **Web chỉ nhanh bằng nguồn chậm nhất mà nó dùng.**
  - Một tập chỉ hiện trên web khi KKPhim hoặc NguonC đã có tập đó. Các trang chuyên hoạt hình như hoathinh3d thường ra tập mới sớm hơn.
  - Đo ngày 30/10: CDN của NguonC trả danh sách "mới cập nhật" và trang chi tiết từ cache cũ khoảng 2 tiếng (`Age` khoảng 7000 giây). Tập mới bên NguonC vì thế có thể tới web trễ khoảng 2 tiếng. Web không cố vượt cache của họ.
  - Danh sách của KKPhim không bị cache, nên tập mới bên đó tới web trong khoảng 5 phút (khi worker đang chạy).
- **KKPhim gắn nhầm hậu tố "Z" cho giờ Việt Nam.** Adapter đã đọc lại theo +07:00, kèm migration `kkphim_timezone` chuyển các mốc đã lưu. Nhờ vậy "Phim mới cập nhật" xếp đúng thứ tự giữa hai nguồn.
- **Phim đồng bộ trước khi có cột `streamUrl`** chưa có server "Dự phòng". Server này sẽ có khi phim được cập nhật ở nguồn. Muốn lấy lại ngay toàn bộ (kể cả phim không đổi) thì chạy `npm run sync -- --source kkphim --mode backfill --restart --force`.
- **Không đọc được thời điểm đang xem.** Player nằm trong iframe khác domain, nên "Tiếp tục xem" chỉ nhớ **tập** đang xem dở, không nhớ giây.
- **Báo lỗi và yêu cầu gỡ** của người dùng nằm ở `/admin/bao-loi` và `/admin/yeu-cau-go`.
