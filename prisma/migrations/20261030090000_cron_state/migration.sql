-- CreateTable
CREATE TABLE "CronState" (
    "name" TEXT NOT NULL,
    "lockedUntil" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),

    CONSTRAINT "CronState_pkey" PRIMARY KEY ("name")
);


-- Như mọi bảng khác: chặn truy cập qua Data API của Supabase (role sở hữu bảng vẫn dùng bình thường)
ALTER TABLE "CronState" ENABLE ROW LEVEL SECURITY;
