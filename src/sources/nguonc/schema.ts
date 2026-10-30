import { z } from "zod";

export const ncListSchema = z.object({
  items: z.array(z.object({ slug: z.string(), modified: z.string().nullish() })),
  paginate: z.object({ total_page: z.coerce.number() }),
});

export const ncSearchSchema = z.object({
  items: z.array(
    z.object({
      slug: z.string(),
      original_name: z.string().nullish(),
      year: z.unknown(),
      tmdb: z.unknown(),
    }),
  ),
});

const categoryGroup = z.object({
  group: z.object({ name: z.string() }),
  list: z.array(z.object({ name: z.string() })),
});

export const ncDetailSchema = z.object({
  movie: z.object({
    id: z.string().nullish(),
    name: z.string(),
    original_name: z.string().nullish(),
    slug: z.string(),
    year: z.unknown(),
    description: z.string().nullish(),
    total_episodes: z.unknown(),
    current_episode: z.string().nullish(),
    time: z.string().nullish(),
    quality: z.string().nullish(),
    language: z.string().nullish(),
    director: z.unknown(),
    casts: z.unknown(),
    // Thực tế là object { "1": {...}, "2": {...} }, chấp nhận cả mảng cho chắc
    category: z.union([z.record(z.string(), categoryGroup), z.array(categoryGroup)]).nullish(),
    tmdb: z.unknown(),
    imdb: z.object({ id: z.string().nullish() }).nullish(),
    thumb_url: z.string().nullish(),
    thumb_url_webp: z.string().nullish(),
    poster_url: z.string().nullish(),
    poster_url_webp: z.string().nullish(),
    modified: z.string().nullish(),
    episodes: z
      .array(
        z.object({
          server_name: z.string(),
          items: z.array(z.object({ name: z.string(), slug: z.string().nullish(), embed: z.string().nullish() })),
        }),
      )
      .nullish(),
  }),
});
