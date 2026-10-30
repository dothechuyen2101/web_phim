-- Supabase tự công khai schema public qua Data API (REST/GraphQL) cho role anon / authenticated:
-- ai có "anon key" (khóa công khai) cũng đọc/ghi được bảng nếu không chặn — kể cả bảng User.
-- Web không dùng Data API (chỉ kết nối Postgres trực tiếp bằng role sở hữu bảng, role này bỏ qua RLS),
-- nên: bật RLS không kèm policy (= chặn hết) và thu hồi mọi quyền của anon / authenticated.
-- Viết để chạy được cả trên Postgres thường (không có các role của Supabase).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
    -- Bảng / sequence tạo sau này (bởi chính role chạy migration) cũng không tự cấp quyền cho anon
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
  END IF;
END $$;
