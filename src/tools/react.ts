import { z } from "zod";
import type { FluentCommunityClient } from "../client.js";
import { asJsonContent } from "../format.js";

/**
 * Schéma unifié `react` qui couvre les deux endpoints du plugin :
 *
 *   - sur un post     : `POST /feeds/{feed_id}/react`
 *                       (CommentsController@addOrRemovePostReact)
 *                       body : { react_type, remove? }
 *                       — l'utilisateur ne peut pas réagir deux fois au même
 *                         type (le plugin renvoie "already reacted").
 *
 *   - sur un commentaire : `POST /feeds/{feed_id}/comments/{comment_id}/reactions`
 *                          (CommentsController@toggleReaction)
 *                          body : { state }
 *                          — pas de typage côté plugin (un seul type de like).
 *
 * On expose une API normalisée : `target` (`post` | `comment`),
 * `action` (`add` | `remove`). Le tool s'occupe de traduire vers l'endpoint
 * et le body attendu.
 */
export const reactArgsSchema = z.object({
  target: z
    .enum(["post", "comment"])
    .describe("Cible de la réaction : `post` ou `comment`."),
  feed_id: z
    .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
    .describe(
      "ID du post (toujours requis, même quand la cible est un commentaire " +
        "— l'API du plugin attend le couple feed_id + comment_id).",
    ),
  comment_id: z
    .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
    .optional()
    .describe(
      "ID du commentaire (requis uniquement si `target` = `comment`).",
    ),
  action: z
    .enum(["add", "remove"])
    .default("add")
    .describe(
      "Action : `add` (ajouter la réaction, défaut) ou `remove` (retirer).",
    ),
  react_type: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Type de réaction côté post (défaut `like`). Ignoré pour les " +
        "commentaires (le plugin ne supporte qu'un seul type pour eux).",
    ),
});

export const reactTool = {
  name: "react",
  config: {
    title: "Ajouter ou retirer une réaction Fluent Community",
    description:
      "Ajoute ou retire une réaction (like par défaut) sur un post ou un " +
      "commentaire. Pour un post : `POST /feeds/{id}/react` ; pour un " +
      "commentaire : `POST /feeds/{id}/comments/{cid}/reactions`. " +
      "Spécifier `target` (`post` ou `comment`), `feed_id`, et `comment_id` " +
      "si pertinent. `action` = `add` (défaut) ou `remove`. Pour un post, " +
      "préciser éventuellement `react_type` (défaut `like`). Note : un " +
      "utilisateur ne peut pas réagir à son propre contenu (le plugin " +
      "refuse silencieusement selon configuration).",
    inputSchema: reactArgsSchema.shape,
  },
  handler: async (
    args: z.infer<typeof reactArgsSchema>,
    client: FluentCommunityClient,
  ) => {
    if (args.target === "comment") {
      if (args.comment_id === undefined) {
        throw new Error(
          "Paramètre `comment_id` requis quand `target` est `comment`.",
        );
      }
      const raw = (await client.reactToComment(args.feed_id, args.comment_id, {
        state: args.action === "add",
      })) as Record<string, unknown>;
      return asJsonContent({
        target: "comment",
        feed_id: args.feed_id,
        comment_id: args.comment_id,
        action: args.action,
        server_response: raw,
      });
    }

    const raw = (await client.reactToFeed(args.feed_id, {
      react_type: args.react_type ?? "like",
      remove: args.action === "remove",
    })) as Record<string, unknown>;
    return asJsonContent({
      target: "post",
      feed_id: args.feed_id,
      action: args.action,
      react_type: args.react_type ?? "like",
      server_message:
        typeof raw?.message === "string" ? raw.message : null,
      new_count: raw?.new_count ?? null,
    });
  },
} as const;
