import { z } from "zod";
import type { FluentCommunityClient } from "../client.js";
import { asJsonContent, summarizeFeed } from "../format.js";

export const listFeedsArgsSchema = z.object({
  space_id: z
    .union([z.number().int().positive(), z.string().min(1)])
    .optional()
    .describe(
      "ID ou slug de l'espace à filtrer. Optionnel — sans filtre, listing global.",
    ),
  page: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Numéro de page (1-indexé, défaut 1)."),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Nombre de posts par page (défaut 10)."),
});

export const listFeedsTool = {
  name: "list_feeds",
  config: {
    title: "Liste paginée des posts",
    description:
      "Liste paginée des posts (`feeds`), filtrable par espace. " +
      "Renvoie aussi le nombre total et la liste des posts épinglés (sticky).",
    inputSchema: listFeedsArgsSchema.shape,
  },
  handler: async (
    args: z.infer<typeof listFeedsArgsSchema>,
    client: FluentCommunityClient,
  ) => {
    const raw = (await client.listFeeds({
      space_id: args.space_id,
      page: args.page ?? 1,
      per_page: args.per_page ?? 10,
    })) as Record<string, unknown>;
    const feeds = extractFeedsArray(raw);
    const sticky = Array.isArray(raw.sticky) ? raw.sticky : [];
    return asJsonContent({
      space_id: args.space_id ?? null,
      page: args.page ?? 1,
      per_page: args.per_page ?? 10,
      total: extractTotal(raw),
      count: feeds.length,
      sticky_count: sticky.length,
      sticky: sticky.map(summarizeFeed),
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
