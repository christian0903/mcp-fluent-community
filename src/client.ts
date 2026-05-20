/**
 * Wrapper HTTP autour de l'API REST Fluent Community v2.
 *
 * Auth : WordPress Basic Auth + Application Password.
 * Tous les endpoints renvoient du JSON.
 *
 * Conventions :
 * - listings → { feeds: { data: [...], total: N }, sticky: [...], execution_time }
 * - lectures unitaires → { feed: {...}, execution_time }
 *
 * Les méthodes ci-dessous renvoient la réponse JSON brute. Le formatage
 * pour le modèle se fait dans les outils (src/tools/).
 */

import type { FluentCommunityConfig } from "./config.js";

export class FluentCommunityClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(private readonly config: FluentCommunityConfig) {
    this.baseUrl = `${config.siteUrl}/wp-json/fluent-community/v2`;
    const token = Buffer.from(
      `${config.username}:${config.appPassword}`,
      "utf-8",
    ).toString("base64");
    this.authHeader = `Basic ${token}`;
  }

  private async request<T = unknown>(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
        "User-Agent": "mcp-fluent-community/0.1.0",
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Fluent Community API ${response.status} ${response.statusText} on ${url.pathname}${url.search}\n${body.slice(0, 500)}`,
      );
    }

    return (await response.json()) as T;
  }

  /**
   * POST/JSON générique — utilisé pour les écritures (création de post,
   * commentaire, etc.). Le body est sérialisé en JSON. Les valeurs
   * `undefined` sont retirées pour ne pas envoyer `null` côté plugin.
   */
  private async postJson<T = unknown>(
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    const cleanBody: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) cleanBody[key] = value;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "mcp-fluent-community/0.1.0",
      },
      body: JSON.stringify(cleanBody),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Fluent Community API ${response.status} ${response.statusText} on POST ${url.pathname}\n${text.slice(0, 800)}`,
      );
    }

    return (await response.json()) as T;
  }

  // ------------------------------------------------------------------
  // Endpoints exposés par les outils MCP
  // ------------------------------------------------------------------

  listSpaces(): Promise<unknown> {
    return this.request("/spaces");
  }

  searchFeeds(params: { search: string; per_page?: number }): Promise<unknown> {
    return this.request("/feeds", {
      search: params.search,
      per_page: params.per_page ?? 10,
    });
  }

  listFeeds(params: {
    space_id?: number | string;
    page?: number;
    per_page?: number;
  }): Promise<unknown> {
    return this.request("/feeds", {
      space_id: params.space_id,
      page: params.page ?? 1,
      per_page: params.per_page ?? 10,
    });
  }

  getFeedById(id: number | string): Promise<unknown> {
    return this.request(`/feeds/${encodeURIComponent(String(id))}/by-id`);
  }

  getFeedBySlug(slug: string): Promise<unknown> {
    return this.request(`/feeds/${encodeURIComponent(slug)}/by-slug`);
  }

  listFeedComments(
    feedId: number | string,
    params?: { page?: number; per_page?: number },
  ): Promise<unknown> {
    return this.request(
      `/feeds/${encodeURIComponent(String(feedId))}/comments`,
      {
        page: params?.page ?? 1,
        per_page: params?.per_page ?? 20,
      },
    );
  }

  /**
   * Crée un post (feed) dans un espace Fluent Community.
   *
   * Côté plugin (FeedsController@store + FeedsHelper::sanitizeAndValidateData) :
   * - `message` (string, requis) — contenu Markdown du post.
   * - `space` (string slug, requis sauf si "global post" est activé pour
   *   l'utilisateur) — slug de l'espace cible (ex: "general", "bien-debuter").
   * - `title` (string, optionnel — requis si l'espace exige un titre).
   * - `content_type` (string, optionnel — déclenche les filtres typés).
   * - `topic_ids` (number[], optionnel — requis si l'espace exige un topic).
   *
   * Réponse : { feed: {...}, message: "...", last_fetched_timestamp: ... }
   */
  createFeed(params: {
    message: string;
    space?: string;
    title?: string;
    content_type?: string;
    topic_ids?: number[];
  }): Promise<unknown> {
    return this.postJson("/feeds/", {
      message: params.message,
      space: params.space,
      title: params.title,
      content_type: params.content_type,
      topic_ids: params.topic_ids,
    });
  }
}
