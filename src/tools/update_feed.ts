import { z } from "zod";
import type { FluentCommunityClient } from "../client.js";
import { asJsonContent, summarizeFeed } from "../format.js";

export const updateFeedArgsSchema = z.object({
  feed_id: z
    .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
    .describe("ID numérique du post à modifier."),
  message: z
    .string()
    .min(1)
    .describe(
      "Nouveau contenu du post au format Markdown (requis côté plugin). " +
        "Remplace intégralement le message existant.",
    ),
  title: z
    .string()
    .min(1)
    .max(192)
    .optional()
    .describe("Nouveau titre (optionnel, limité à 192 caractères)."),
  content_type: z
    .string()
    .min(1)
    .optional()
    .describe("Type de contenu (optionnel : `text`, `image`, `link`, etc.)."),
  topic_ids: z
    .array(z.number().int().positive())
    .optional()
    .describe("Nouvelle liste de topic IDs (optionnel)."),
  status: z
    .enum(["published", "unlisted", "scheduled", "pending"])
    .optional()
    .describe(
      "Statut éditorial (optionnel). Le post doit être dans un statut éditable.",
    ),
});

export const updateFeedTool = {
  name: "update_feed",
  config: {
    title: "Modification d'un post Fluent Community",
    description:
      "Modifie un post existant via `POST /feeds/{id}`. Le `message` est " +
      "requis et remplace intégralement le contenu existant. Le post doit " +
      "être dans un statut éditable (`published`, `unlisted`, `scheduled`, " +
      "`pending`) et l'utilisateur doit avoir le droit de l'éditer. " +
      "ATTENTION — la modification est immédiate côté communauté.",
    inputSchema: updateFeedArgsSchema.shape,
  },
  handler: async (
    args: z.infer<typeof updateFeedArgsSchema>,
    client: FluentCommunityClient,
  ) => {
    const raw = (await client.updateFeed(args.feed_id, {
      message: args.message,
      title: args.title,
      content_type: args.content_type,
      topic_ids: args.topic_ids,
      status: args.status,
    })) as Record<string, unknown>;

    const feed = raw && typeof raw === "object" ? (raw.feed ?? raw) : raw;
    return asJsonContent({
      feed: summarizeFeed(feed),
      server_message:
        typeof raw?.message === "string" ? raw.message : null,
    });
  },
} as const;
