-- KKPhim trả giờ Việt Nam nhưng gắn nhầm hậu tố "Z". Adapter giờ đã đọc theo +07:00;
-- đưa các mốc đã lưu trước đó về UTC thật để so sánh "có thay đổi" và sắp xếp "mới cập nhật" đúng.
UPDATE "MovieSource"
SET "lastModified" = "lastModified" - INTERVAL '7 hours'
WHERE "lastModified" IS NOT NULL
  AND "sourceId" IN (SELECT "id" FROM "Source" WHERE "key" = 'kkphim');

-- Mốc "cập nhật ở nguồn" của phim = mốc mới nhất trong các nguồn của nó
UPDATE "Movie" AS m
SET "sourceModifiedAt" = s."maxModified"
FROM (
  SELECT "movieId", MAX("lastModified") AS "maxModified"
  FROM "MovieSource"
  GROUP BY "movieId"
) AS s
WHERE s."movieId" = m."id" AND s."maxModified" IS NOT NULL;
