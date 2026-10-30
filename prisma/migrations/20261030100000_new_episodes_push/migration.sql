-- Thời điểm web thêm tập: dùng cho trang "Tập mới" và thông báo tập mới
ALTER TABLE "Episode" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- Tập đã có: lấy theo lúc thêm phim, để không bị tính là "tập mới" (tập mới = thêm sau khi phim đã có trên web)
UPDATE "Episode" e SET "createdAt" = m."createdAt" FROM "Movie" m WHERE m."id" = e."movieId";

-- Thiết bị đã bật thông báo tập mới (Web Push)
CREATE TABLE "PushSubscription" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
-- Supabase công khai schema public qua Data API: bảng mới phải bật RLS (xem migration supabase_lockdown)
ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
-- CreateIndex
CREATE INDEX "Episode_createdAt_idx" ON "Episode"("createdAt");
-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
