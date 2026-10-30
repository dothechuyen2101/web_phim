import { z } from "zod";

const taxon = z.object({ name: z.string(), slug: z.string() });

const listItem = z.object({
  slug: z.string(),
  origin_name: z.string().nullish(),
  year: z.unknown(),
  tmdb: z.unknown(),
  modified: z.object({ time: z.string() }).nullish(),
});

export const vsListSchema = z.object({
  items: z.array(listItem),
  pagination: z.object({ totalPages: z.coerce.number() }),
});

export const vsSearchSchema = z.object({ items: z.array(listItem) });

export const vsDetailSchema = z.object({
  movie: z.object({
    _id: z.union([z.number(), z.string()]).nullish(),
    name: z.string(),
    slug: z.string(),
    origin_name: z.string().nullish(),
    content: z.string().nullish(),
    type: z.string().nullish(),
    status: z.string().nullish(),
    thumb_url: z.string().nullish(),
    poster_url: z.string().nullish(),
    time: z.unknown(),
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
        server_data: z.array(
          z.object({ name: z.string(), slug: z.string().nullish(), link_embed: z.string().nullish() }),
        ),
      }),
    )
    .nullish(),
});
