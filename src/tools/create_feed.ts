import { z } from "zod";
import type { FluentCommunityClient } from "../client.js";
import { asJsonContent, summarizeFeed } from "../format.js";

export const createFeedArgsSchema = z.object({
  message: z
    .string()
    .min(1)
    .describe(
      "Contenu du post au format Markdown (requis). Supporte les sauts de ligne, " +
        "le gras, les liens, les listes, et les mentions `@username`.",
    ),
  space: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Slug de l'espace cible (ex: `general`, `bien-debuter`, `presentation`). " +
        "Requis sauf si l'utilisateur a la permission de poster en global. " +
        "À récupérer via `list_spaces` si inconnu.",
    ),
  title: z
    .string()
    .min(1)
    .max(192)
    .optional()
    .describe(
      "Titre du post (optionnel — requis dans les espaces qui exigent un titre, " +
        "limité à 192 caractères côté plugin).",
    ),
  content_type: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Type de contenu (optionnel, défaut `text`). Permet de déclencher les " +
        "filtres typés du plugin (ex: `image`, `link`, `survey`).",
    ),
  topic_ids: z
    .array(z.number().int().positive())
    .optional()
    .describe(
      "Liste d'IDs de topics à attacher au post (optionnel — requis dans les " +
        "espaces où la sélection d'un topic est obligatoire).",
    ),
});

export const createFeedTool = {
  name: "create_feed",
  config: {
    title: "Création d'un post Fluent Community",
    description:
      "Crée un post (feed) dans Fluent Community. Le `message` est requis ; " +
      "le `space` (slug) est requis sauf si l'utilisateur a le droit de poster " +
      "en global. La réponse contient l'objet `feed` créé avec son `id`, son " +
      "`permalink` et son contenu rendu en HTML. ATTENTION — cette opération " +
      "publie immédiatement le post côté communauté : à n'utiliser qu'avec un " +
      "espace de test sauf intention claire de publication.",
    inputSchema: createFeedArgsSchema.shape,
  },
  handler: async (
    args: z.infer<typeof createFeedArgsSchema>,
    client: FluentCommunityClient,
  ) => {
    const raw = (await client.createFeed({
      message: args.message,
      space: args.space,
      title: args.title,
      content_type: args.content_type,
      topic_ids: args.topic_ids,
    })) as Record<string, unknown>;

    const feed = raw && typeof raw === "object" ? (raw.feed ?? raw) : raw;
    return asJsonContent({
      feed: summarizeFeed(feed),
      server_message:
        typeof raw?.message === "string" ? raw.message : null,
      last_fetched_timestamp: raw?.last_fetched_timestamp ?? null,
    });
  },
} as const;
