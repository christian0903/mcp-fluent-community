import { z } from "zod";
import type { FluentCommunityClient } from "../client.js";
import { asJsonContent, summarizeComment } from "../format.js";

export const listFeedCommentsArgsSchema = z.object({
  feed_id: z
    .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
    .describe("ID numérique du post dont on veut les commentaires."),
  page: z.number().int().min(1).optional().describe("Numéro de page (défaut 1)."),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Nombre de commentaires par page (défaut 20)."),
});

export const listFeedCommentsTool = {
  name: "list_feed_comments",
  config: {
    title: "Liste des commentaires d'un post",
    description:
      "Récupère les commentaires d'un post Fluent Community via " +
      "`GET /feeds/{id}/comments`. Renvoie une liste résumée (id, auteur, contenu).",
    inputSchema: listFeedCommentsArgsSchema.shape,
  },
  handler: async (
    args: z.infer<typeof listFeedCommentsArgsSchema>,
    client: FluentCommunityClient,
  ) => {
    const raw = (await client.listFeedComments(args.feed_id, {
      page: args.page ?? 1,
      per_page: args.per_page ?? 20,
    })) as Record<string, unknown>;
    const comments = extractCommentsArray(raw);
    return asJsonContent({
      feed_id: args.feed_id,
      page: args.page ?? 1,
      per_page: args.per_page ?? 20,
      total: extractTotal(raw),
      count: comments.length,
      comments: comments.map(summarizeComment),
    });
  },
} as const;

function extractCommentsArray(raw: unknown): unknown[] {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.comments)) return r.comments;
  if (r.comments && typeof r.comments === "object") {
    const data = (r.comments as Record<string, unknown>).data;
    if (Array.isArray(data)) return data;
  }
  if (Array.isArray(r.data)) return r.data;
  return [];
}

function extractTotal(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.comments && typeof r.comments === "object") {
    const total = (r.comments as Record<string, unknown>).total;
    if (typeof total === "number") return total;
    if (typeof total === "string" && /^\d+$/.test(total)) return Number(total);
  }
  if (typeof r.total === "number") return r.total;
  return null;
}
