import { z } from "zod";
import type { FluentCommunityClient } from "../client.js";
import { asJsonContent, summarizeFeed } from "../format.js";

export const searchFeedsArgsSchema = z.object({
  search: z
    .string()
    .min(1)
    .describe("Terme recherché (texte plein, accents FR supportés)."),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Nombre max de résultats (défaut 10)."),
});

export const searchFeedsTool = {
  name: "search_feeds",
  config: {
    title: "Recherche full-text dans les posts",
    description:
      "Recherche full-text dans les posts de Fluent Community via GET /feeds?search=. " +
      "Renvoie une liste résumée (id, titre, slug, auteur, espace, permalink, contenu strippé).",
    inputSchema: searchFeedsArgsSchema.shape,
  },
  handler: async (
    args: z.infer<typeof searchFeedsArgsSchema>,
    client: FluentCommunityClient,
  ) => {
    const raw = (await client.searchFeeds({
      search: args.search,
      per_page: args.per_page ?? 10,
    })) as Record<string, unknown>;
    const feeds = extractFeedsArray(raw);
    return asJsonContent({
      search: args.search,
      total: extractTotal(raw),
      count: feeds.length,
      feeds: feeds.map(summarizeFeed),
    });
  },
} as const;

function extractFeedsArray(raw: unknown): unknown[] {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as Record<string, unknown>;
  if (r.feeds && typeof r.feeds === "object") {
    const data = (r.feeds as Record<string, unknown>).data;
    if (Array.isArray(data)) return data;
  }
  if (Array.isArray(r.feeds)) return r.feeds;
  if (Array.isArray(r.data)) return r.data;
  return [];
}

function extractTotal(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.feeds && typeof r.feeds === "object") {
    const total = (r.feeds as Record<string, unknown>).total;
    if (typeof total === "number") return total;
    if (typeof total === "string" && /^\d+$/.test(total)) return Number(total);
  }
  return null;
}
