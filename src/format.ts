/**
 * Helpers de formatage pour réduire le bruit dans les réponses MCP
 * et faciliter la lecture par le modèle.
 */

/**
 * Strip HTML très simple : retire les balises, décode quelques entités
 * courantes, normalise les sauts de ligne. Suffisant pour un usage de
 * lecture par un LLM — pas une sanitisation de sécurité.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  let text = String(html);

  // Bloc → saut de ligne
  text = text.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  text = text.replace(/<\/?\s*(p|div|li|h[1-6]|blockquote|tr)\s*[^>]*>/gi, "\n");
  text = text.replace(/<\/\s*ul\s*>/gi, "\n");
  text = text.replace(/<\/\s*ol\s*>/gi, "\n");

  // Reste des balises
  text = text.replace(/<[^>]+>/g, "");

  // Entités HTML courantes
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&hellip;/g, "…")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–");

  // Normaliser les sauts de ligne et espaces
  text = text.replace(/\r\n?/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text
    .split("\n")
    .map((l) => l.trim())
    .join("\n");
  return text.trim();
}

/**
 * Réduit un objet `feed` brut à une projection utile pour le modèle :
 * id, titre, slug, auteur, espace, dates, permalink, contenu HTML
 * et version texte strippée.
 */
export function summarizeFeed(feed: unknown): Record<string, unknown> {
  if (!feed || typeof feed !== "object") return { raw: feed };
  const f = feed as Record<string, unknown>;
  const xprofile = (f.xprofile ?? {}) as Record<string, unknown>;
  const space = (f.space ?? {}) as Record<string, unknown>;

  const html =
    (typeof f.message_rendered === "string" ? f.message_rendered : "") ||
    (typeof f.message === "string" ? f.message : "");

  return {
    id: f.id,
    title: f.title ?? null,
    slug: f.slug ?? null,
    permalink: f.permalink ?? null,
    status: f.status ?? null,
    type: f.type ?? null,
    content_type: f.content_type ?? null,
    created_at: f.created_at ?? null,
    updated_at: f.updated_at ?? null,
    comments_count: f.comments_count ?? f.total_comments ?? null,
    reactions_count: f.reactions_count ?? null,
    author: {
      id: xprofile.user_id ?? null,
      username: xprofile.username ?? null,
      display_name: xprofile.display_name ?? null,
    },
    space: {
      id: space.id ?? null,
      slug: space.slug ?? null,
      title: space.title ?? null,
      privacy: space.privacy ?? null,
    },
    content_html: html,
    content_text: stripHtml(html),
  };
}

/**
 * Réduit un objet `space` brut à une projection utile.
 */
export function summarizeSpace(space: unknown): Record<string, unknown> {
  if (!space || typeof space !== "object") return { raw: space };
  const s = space as Record<string, unknown>;
  return {
    id: s.id,
    slug: s.slug ?? null,
    title: s.title ?? null,
    description: s.description ?? null,
    privacy: s.privacy ?? null,
    type: s.type ?? null,
    members_count: s.members_count ?? null,
    posts_count: s.posts_count ?? null,
  };
}

/**
 * Réduit un commentaire à une projection utile.
 */
export function summarizeComment(comment: unknown): Record<string, unknown> {
  if (!comment || typeof comment !== "object") return { raw: comment };
  const c = comment as Record<string, unknown>;
  const xprofile = (c.xprofile ?? {}) as Record<string, unknown>;
  const html =
    (typeof c.message_rendered === "string" ? c.message_rendered : "") ||
    (typeof c.message === "string" ? c.message : "");
  return {
    id: c.id,
    feed_id: c.feed_id ?? null,
    parent_id: c.parent_id ?? null,
    created_at: c.created_at ?? null,
    author: {
      id: xprofile.user_id ?? null,
      username: xprofile.username ?? null,
      display_name: xprofile.display_name ?? null,
    },
    content_html: html,
    content_text: stripHtml(html),
  };
}

/**
 * Encapsule une payload en bloc texte JSON compatible MCP content.
 */
export function asJsonContent(payload: unknown): {
  content: { type: "text"; text: string }[];
} {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}
