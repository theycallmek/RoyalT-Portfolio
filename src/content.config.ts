import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { linkSchema, postSchema } from "./lib/schemas";

const md = (dir: string) =>
  glob({ pattern: "**/*.md", base: `./src/content/${dir}` });

export const collections = {
  links: defineCollection({ loader: md("links"), schema: linkSchema }),
  posts: defineCollection({ loader: md("posts"), schema: postSchema }),
};
