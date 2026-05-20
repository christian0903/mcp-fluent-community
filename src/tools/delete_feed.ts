import { z } from "zod";
import type { FluentCommunityClient } from "../client.js";
import { asJsonContent } from "../format.js";

export const deleteFeedArgsSchema = z.object({
  feed_id: z
    .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
    .describe("ID numérique du post à supprimer."),
});

export const deleteFeedTool = {
  name: "delete_feed",
  config: {
    title: "Suppression d'un post Fluent Community",
    description:
      "Supprime définitivement un post via `DELETE /feeds/{id}`. " +
      "**OPÉRATION IRRÉVERSIBLE** — le post, ses médias et ses commentaires " +
      "sont supprimés côté communauté ; aucune corbeille, aucun undo. " +
      "L'utilisateur doit être l'auteur du post ou avoir la permission " +
      "`delete_any_feed` dans l'espace concerné. À n'invoquer qu'avec une " +
      "intention claire et explicite de l'utilisateur — un agent Cowork ne " +
      "doit pas appeler cette fonction sans confirmation préalable.",
    inputSchema: deleteFeedArgsSchema.shape,
  },
  handler: async (
    args: z.infer<typeof deleteFeedArgsSchema>,
    client: FluentCommunityClient,
  ) => {
    const raw = (await client.deleteFeed(args.feed_id)) as Record<
      string,
      unknown
    >;
    return asJsonContent({
      feed_id: args.feed_id,
      deleted: true,
      server_message:
        typeof raw?.message === "string" ? raw.message : null,
    });
  },
} as const;
