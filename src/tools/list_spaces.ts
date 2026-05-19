import { z } from "zod";
import type { FluentCommunityClient } from "../client.js";
import { asJsonContent, summarizeSpace } from "../format.js";

export const listSpacesTool = {
  name: "list_spaces",
  config: {
    title: "Liste les espaces Fluent Community",
    description:
      "Énumère les espaces (groupes / catégories) accessibles avec l'utilisateur courant. " +
      "Utile pour découvrir les `space_id` et `slug` à passer à `list_feeds`.",
    inputSchema: {},
  },
  handler: async (
    _args: Record<string, never>,
    client: FluentCommunityClient,
  ) => {
    const raw = (await client.listSpaces()) as unknown;
    const items = extractSpaceArray(raw);
    return asJsonContent({
      count: items.length,
      spaces: items.map(summarizeSpace),
    });
  },
} as const;

function extractSpaceArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.spaces)) return r.spaces;
    if (r.spaces && typeof r.spaces === "object") {
      const inner = (r.spaces as Record<string, unknown>).data;
      if (Array.isArray(inner)) return inner;
    }
    if (Array.isArray(r.data)) return r.data;
  }
  return [];
}

// Schéma zod conservé pour documentation interne — l'inputSchema MCP est vide.
export const listSpacesArgsSchema = z.object({});
