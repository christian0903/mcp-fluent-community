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

  /**
   * DELETE générique. Le plugin n'attend pas de body pour les suppressions
   * exposées par ce MCP (`/feeds/{id}`, `/feeds/{id}/comments/{cid}`).
   */
  private async deleteRequest<T = unknown>(path: string): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
        "User-Agent": "mcp-fluent-community/0.1.0",
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Fluent Community API ${response.status} ${response.statusText} on DELETE ${url.pathname}\n${text.slice(0, 800)}`,
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

  /**
   * Met à jour un post existant.
   * Route plugin : `POST /feeds/{feed_id}` → FeedsController@update.
   * Le champ `message` (Markdown) est obligatoire côté plugin
   * (sanitizeAndValidateData). Les autres champs sont optionnels.
   */
  updateFeed(
    feedId: number | string,
    params: {
      message: string;
      title?: string;
      content_type?: string;
      topic_ids?: number[];
      status?: string;
    },
  ): Promise<unknown> {
    return this.postJson(`/feeds/${encodeURIComponent(String(feedId))}`, {
      message: params.message,
      title: params.title,
      content_type: params.content_type,
      topic_ids: params.topic_ids,
      status: params.status,
    });
  }

  /**
   * Supprime un post (opération irréversible).
   * Route plugin : `DELETE /feeds/{feed_id}` → FeedsController@deleteFeed.
   */
  deleteFeed(feedId: number | string): Promise<unknown> {
    return this.deleteRequest(`/feeds/${encodeURIComponent(String(feedId))}`);
  }

  /**
   * Crée un commentaire sur un post.
   * Route plugin : `POST /feeds/{feed_id}/comments` → CommentsController@store.
   * Côté plugin, le champ texte du commentaire s'appelle `comment` (pas
   * `message` comme pour les feeds — vérifié dans
   * CommentsController::validateCommentText).
   * Paramètres : `message` (Markdown, mappé sur `comment`),
   * `parent_id` (optionnel, pour réponse en thread).
   */
  createComment(
    feedId: number | string,
    params: { message: string; parent_id?: number },
  ): Promise<unknown> {
    return this.postJson(
      `/feeds/${encodeURIComponent(String(feedId))}/comments`,
      {
        comment: params.message,
        parent_id: params.parent_id,
      },
    );
  }

  /**
   * Supprime un commentaire (opération irréversible).
   * Route plugin : `DELETE /feeds/{feed_id}/comments/{comment_id}`
   *   → CommentsController@deleteComment.
   */
  deleteComment(
    feedId: number | string,
    commentId: number | string,
  ): Promise<unknown> {
    return this.deleteRequest(
      `/feeds/${encodeURIComponent(String(feedId))}/comments/${encodeURIComponent(String(commentId))}`,
    );
  }

  /**
   * Réagit à un post (ajoute ou retire une réaction).
   * Route plugin : `POST /feeds/{feed_id}/react`
   *   → CommentsController@addOrRemovePostReact.
   * Body : `react_type` (défaut `like`) ; `remove` (truthy → retrait).
   */
  reactToFeed(
    feedId: number | string,
    params: { react_type?: string; remove?: boolean },
  ): Promise<unknown> {
    return this.postJson(
      `/feeds/${encodeURIComponent(String(feedId))}/react`,
      {
        react_type: params.react_type ?? "like",
        // Le contrôleur teste `truthy` — envoyer "1"/"" plutôt que bool
        // pour rester compatible avec les body parsers WP REST.
        remove: params.remove ? 1 : undefined,
      },
    );
  }

  /**
   * Réagit à un commentaire (toggle).
   * Route plugin : `POST /feeds/{feed_id}/comments/{comment_id}/reactions`
   *   → CommentsController@toggleReaction.
   * Body : `state` (truthy = ajouter, falsy = retirer).
   */
  reactToComment(
    feedId: number | string,
    commentId: number | string,
    params: { state: boolean },
  ): Promise<unknown> {
    return this.postJson(
      `/feeds/${encodeURIComponent(String(feedId))}/comments/${encodeURIComponent(String(commentId))}/reactions`,
      {
        state: params.state ? 1 : 0,
      },
    );
  }
}
