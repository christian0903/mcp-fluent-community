import { z } from "zod";
import type { FluentCommunityClient } from "../client.js";
import { asJsonContent, summarizeComment } from "../format.js";

export const createCommentArgsSchema = z.object({
  feed_id: z
    .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
    .describe("ID numérique du post à commenter."),
  message: z
    .string()
    .min(1)
    .describe(
      "Contenu du commentaire au format Markdown (requis). " +
        "Supporte les sauts de ligne, le gras, les liens, et les mentions `@username`.",
    ),
  parent_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "ID d'un commentaire parent pour répondre en thread (optionnel). " +
        "Doit appartenir au même post.",
    ),
});

export const createCommentTool = {
  name: "create_comment",
  config: {
    title: "Création d'un commentaire Fluent Community",
    description:
      "Crée un commentaire sur un post via `POST /feeds/{id}/comments`. " +
      "Le post doit être publié et l'utilisateur doit avoir le droit de " +
      "commenter dans l'espace. Pour répondre à un commentaire existant, " +
      "passer son ID dans `parent_id`. ATTENTION — la publication est " +
      "immédiate côté communauté.",
    inputSchema: createCommentArgsSchema.shape,
  },
  handler: async (
    args: z.infer<typeof createCommentArgsSchema>,
    client: FluentCommunityClient,
  ) => {
    const raw = (await client.createComment(args.feed_id, {
      message: args.message,
      parent_id: args.parent_id,
    })) as Record<string, unknown>;

    const comment =
      raw && typeof raw === "object" ? (raw.comment ?? raw) : raw;
    return asJsonContent({
      comment: summarizeComment(comment),
      server_message:
        typeof raw?.message === "string" ? raw.message : null,
    });
  },
} as const;
