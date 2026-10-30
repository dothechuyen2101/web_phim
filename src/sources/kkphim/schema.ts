import { z } from "zod";

const taxon = z.object({ name: z.string(), slug: z.string() });

export const kkListSchema = z.object({
  items: z.array(
    z.object({
      slug: z.string(),
      modified: z.object({ time: z.string() }).nullish(),
    }),
  ),
  pagination: z.object({ totalPages: z.coerce.number() }),
});

export const kkDetailSchema = z.object({
  status: z.union([z.boolean(), z.string()]).optional(),
  movie: z.object({
    _id: z.string().nullish(),
    name: z.string(),
    slug: z.string(),
    origin_name: z.string().nullish(),
    alternative_names: z.array(z.string()).nullish(),
    content: z.string().nullish(),
    type: z.string().nullish(),
    status: z.string().nullish(),
    thumb_url: z.string().nullish(),
    poster_url: z.string().nullish(),
    time: z.string().nullish(),
    episode_current: z.string().nullish(),
    episode_total: z.unknown(),
    quality: z.string().nullish(),
    lang: z.string().nullish(),
    year: z.unknown(),
    actor: z.unknown(),
    director: z.unknown(),
    category: z.array(taxon).nullish(),
    country: z.array(taxon).nullish(),
    tmdb: z.unknown(),
    imdb: z.object({ id: z.string().nullish() }).nullish(),
    modified: z.object({ time: z.string() }).nullish(),
  }),
  episodes: z
    .array(
      z.object({
        server_name: z.string(),
        is_ai: z.boolean().nullish(),
        server_data: z.array(
          z.object({
            name: z.string(),
            slug: z.string().nullish(),
            link_embed: z.string().nullish(),
            link_m3u8: z.string().nullish(),
          }),
        ),
      }),
    )
    .nullish(),
});

export const kkTaxonomySchema = z.object({
  data: z.object({ items: z.array(taxon) }),
});

export const kkSearchSchema = z.object({
  data: z.object({
    items: z.array(
      z.object({
        slug: z.string(),
        origin_name: z.string().nullish(),
        year: z.unknown(),
        tmdb: z.unknown(),
      }),
    ),
  }),
});
