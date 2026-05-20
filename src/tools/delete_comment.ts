import { z } from "zod";
import type { FluentCommunityClient } from "../client.js";
import { asJsonContent } from "../format.js";

export const deleteCommentArgsSchema = z.object({
  feed_id: z
    .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
    .describe("ID du post auquel appartient le commentaire."),
  comment_id: z
    .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
    .describe("ID numérique du commentaire à supprimer."),
});

export const deleteCommentTool = {
  name: "delete_comment",
  config: {
    title: "Suppression d'un commentaire Fluent Community",
    description:
      "Supprime définitivement un commentaire via " +
      "`DELETE /feeds/{feed_id}/comments/{comment_id}`. **OPÉRATION " +
      "IRRÉVERSIBLE**. L'utilisateur doit être l'auteur du commentaire ou " +
      "avoir la permission `delete_any_comment` dans l'espace. À n'invoquer " +
      "qu'avec une intention explicite — pas d'appel automatique par un " +
      "agent Cowork sans confirmation.",
    inputSchema: deleteCommentArgsSchema.shape,
  },
  handler: async (
    args: z.infer<typeof deleteCommentArgsSchema>,
    client: FluentCommunityClient,
  ) => {
    const raw = (await client.deleteComment(
      args.feed_id,
      args.comment_id,
    )) as Record<string, unknown>;
    return asJsonContent({
      feed_id: args.feed_id,
      comment_id: args.comment_id,
      deleted: true,
      server_message:
        typeof raw?.message === "string" ? raw.message : null,
    });
  },
} as const;
