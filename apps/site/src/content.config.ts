import { docsSchema } from "@astrojs/starlight/schema";
import { z } from "astro/zod";
import { defineCollection } from "astro:content";

import { docsCatalogLoader } from "./docs/loader";

const translationStatus = z.enum(["translated", "missing", "stale"]).default("translated");

const extend = z.object({ translationStatus });

export const collections = {
  docs: defineCollection({
    loader: docsCatalogLoader(),
    schema: docsSchema({ extend }),
  }),
};
