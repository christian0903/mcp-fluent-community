import { z } from "zod";
import type { FluentCommunityClient } from "../client.js";
import { asJsonContent, summarizeFeed } from "../format.js";

export const getFeedByIdArgsSchema = z.object({
  id: z
    .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
    .describe("ID numérique du post à lire."),
});

export const getFeedByIdTool = {
  name: "get_feed_by_id",
  config: {
    title: "Lecture d'un post par ID",
    description:
      "Récupère un post Fluent Community par son `id` numérique. " +
      "Renvoie la projection résumée avec contenu HTML et texte strippé.",
    inputSchema: getFeedByIdArgsSchema.shape,
  },
  handler: async (
    args: z.infer<typeof getFeedByIdArgsSchema>,
    client: FluentCommunityClient,
  ) => {
    const raw = (await client.getFeedById(args.id)) as Record<string, unknown>;
    const feed = raw && typeof raw === "object" ? (raw.feed ?? raw) : raw;
    return asJsonContent({
      feed: summarizeFeed(feed),
      execution_time: raw?.execution_time ?? null,
    });
  },
} as const;
