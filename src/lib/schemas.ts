import { z } from "astro/zod";

export const LINK_CATEGORIES = [
  "3d-printing",
  "code",
  "social",
  "other",
] as const;

export const linkSchema = z.object({
  title: z.string().min(1),
  url: z.url(),
  category: z.enum(LINK_CATEGORIES),
  description: z.string().optional(),
  order: z.number().default(0),
});

export const postSchema = z.object({
  title: z.string().min(1),
  date: z.coerce.date(),
  summary: z.string().min(1),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  // set for posts that live on another site: the row links out and no local page is built
  url: z.url().optional(),
  // preview text shown under the title (e.g. the first paragraph); clamped to a few lines
  excerpt: z.string().min(1).optional(),
  // thumbnail: a file in src/assets/posts/ (local, so it works when the linked site is down)
  image: z
    .string()
    .regex(/^[\w-]+\.webp$/)
    .optional(),
});

export const makerworldSchema = z.object({
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  profileUrl: z.url(),
  models: z.number().int().nonnegative(),
  downloads: z.number().int().nonnegative(),
  likes: z.number().int().nonnegative(),
  // all designs, most downloaded first (scripts/makerworld-import.ts)
  items: z
    .array(
      z.object({
        title: z.string().min(1),
        url: z.url(),
        imageUrl: z.url().optional(),
        // local cover in src/assets/makerworld/, written by scripts/makerworld-import.ts
        image: z
          .string()
          .regex(/^[\w-]+\.webp$/)
          .optional(),
        downloads: z.number().int().nonnegative(),
        likes: z.number().int().nonnegative(),
        prints: z.number().int().nonnegative(),
        published: z.iso.datetime(),
      }),
    )
    .max(60),
});
