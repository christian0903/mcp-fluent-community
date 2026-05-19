import { z } from "zod";
import type { FluentCommunityClient } from "../client.js";
import { asJsonContent, summarizeFeed } from "../format.js";

export const getFeedBySlugArgsSchema = z.object({
  slug: z
    .string()
    .min(1)
    .describe("Slug du post (segment d'URL) à lire."),
});

export const getFeedBySlugTool = {
  name: "get_feed_by_slug",
  config: {
    title: "Lecture d'un post par slug",
    description:
      "Récupère un post Fluent Community par son `slug` (segment d'URL). " +
      "Renvoie la projection résumée avec contenu HTML et texte strippé.",
    inputSchema: getFeedBySlugArgsSchema.shape,
  },
  handler: async (
    args: z.infer<typeof getFeedBySlugArgsSchema>,
    client: FluentCommunityClient,
  ) => {
    const raw = (await client.getFeedBySlug(args.slug)) as Record<
      string,
      unknown
    >;
    const feed = raw && typeof raw === "object" ? (raw.feed ?? raw) : raw;
    return asJsonContent({
      feed: summarizeFeed(feed),
      execution_time: raw?.execution_time ?? null,
    });
  },
} as const;
