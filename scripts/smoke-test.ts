/**
 * Smoke test : valide les outils du MCP fluent-community contre l'instance
 * configurée par les variables d'environnement (FC_SITE_URL, FC_USERNAME,
 * FC_APP_PASSWORD).
 *
 * Couvre par défaut les 6 outils de lecture. Le bloc d'écriture (round-trip
 * auto-nettoyant : create_feed → update_feed → create_comment → react →
 * delete_comment → delete_feed) n'est exécuté que si `FC_TEST_SPACE_SLUG`
 * est défini. Exemple :
 *
 *   FC_TEST_SPACE_SLUG=mon-bac-a-sable tsx scripts/smoke-test.ts
 *
 * Auto-nettoyage : le post de test (et son commentaire) sont supprimés
 * en fin de séquence via les nouveaux tools de delete. En cas d'échec
 * intermédiaire, on tente quand même la suppression pour ne pas polluer
 * l'espace cible.
 *
 * Exit code 0 si tous les checks passent, 1 sinon. Pensé pour être lancé
 * en local par le développeur, pas en CI publique (le `.env` n'est pas
 * versionné).
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/config.js";

// Charge .env minimaliste (sans dépendance externe)
loadDotEnv();

function loadDotEnv(): void {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const envPath = resolve(here, "..", ".env");
    const raw = readFileSync(envPath, "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env absent : on s'appuie sur les env vars déjà définies
  }
}
import { FluentCommunityClient } from "../src/client.js";
import { listSpacesTool } from "../src/tools/list_spaces.js";
import { searchFeedsTool } from "../src/tools/search_feeds.js";
import { listFeedsTool } from "../src/tools/list_feeds.js";
import { getFeedByIdTool } from "../src/tools/get_feed_by_id.js";
import { getFeedBySlugTool } from "../src/tools/get_feed_by_slug.js";
import { listFeedCommentsTool } from "../src/tools/list_feed_comments.js";
import { createFeedTool } from "../src/tools/create_feed.js";
import { updateFeedTool } from "../src/tools/update_feed.js";
import { deleteFeedTool } from "../src/tools/delete_feed.js";
import { createCommentTool } from "../src/tools/create_comment.js";
import { deleteCommentTool } from "../src/tools/delete_comment.js";
import { reactTool } from "../src/tools/react.js";

type Result = { name: string; ok: boolean; detail: string };

async function run(): Promise<void> {
  const config = loadConfig();
  const client = new FluentCommunityClient(config);
  const results: Result[] = [];

  // 1. list_spaces
  try {
    const r = await listSpacesTool.handler({}, client);
    const parsed = JSON.parse(r.content[0]!.text) as {
      count: number;
      spaces: unknown[];
    };
    results.push({
      name: "list_spaces",
      ok: parsed.count >= 0,
      detail: `${parsed.count} espace(s)`,
    });
  } catch (err) {
    results.push({ name: "list_spaces", ok: false, detail: String(err) });
  }

  // 2. search_feeds — validation explicite : "popper" doit retrouver #250
  let popperFound = false;
  let popperPostId: number | null = null;
  let popperSlug: string | null = null;
  try {
    const r = await searchFeedsTool.handler(
      { search: "popper", per_page: 10 },
      client,
    );
    const parsed = JSON.parse(r.content[0]!.text) as {
      count: number;
      feeds: Array<{ id: number; slug: string; title: string | null }>;
    };
    const hit = parsed.feeds.find((f) => Number(f.id) === 250);
    if (hit) {
      popperFound = true;
      popperPostId = Number(hit.id);
      popperSlug = hit.slug;
    }
    results.push({
      name: 'search_feeds("popper")',
      ok: popperFound,
      detail: popperFound
        ? `post #${popperPostId} trouvé, slug=${popperSlug}`
        : `aucun post #250 dans les ${parsed.count} résultats`,
    });
  } catch (err) {
    results.push({
      name: 'search_feeds("popper")',
      ok: false,
      detail: String(err),
    });
  }

  // 3. list_feeds
  try {
    const r = await listFeedsTool.handler({ per_page: 3 }, client);
    const parsed = JSON.parse(r.content[0]!.text) as {
      count: number;
      total: number | null;
    };
    results.push({
      name: "list_feeds",
      ok: parsed.count > 0,
      detail: `${parsed.count} posts (total=${parsed.total})`,
    });
  } catch (err) {
    results.push({ name: "list_feeds", ok: false, detail: String(err) });
  }

  // 4. get_feed_by_id — utilise #250 si trouvé, sinon skip
  if (popperPostId !== null) {
    try {
      const r = await getFeedByIdTool.handler({ id: popperPostId }, client);
      const parsed = JSON.parse(r.content[0]!.text) as {
        feed: { id: number; content_text: string };
      };
      const hasContent = parsed.feed.content_text.length > 100;
      results.push({
        name: `get_feed_by_id(${popperPostId})`,
        ok: hasContent,
        detail: `${parsed.feed.content_text.length} chars texte strippé`,
      });
    } catch (err) {
      results.push({
        name: `get_feed_by_id(${popperPostId})`,
        ok: false,
        detail: String(err),
      });
    }
  } else {
    results.push({
      name: "get_feed_by_id",
      ok: false,
      detail: "skipped — search_feeds n'a pas trouvé #250",
    });
  }

  // 5. get_feed_by_slug
  if (popperSlug) {
    try {
      const r = await getFeedBySlugTool.handler({ slug: popperSlug }, client);
      const parsed = JSON.parse(r.content[0]!.text) as {
        feed: { id: number; content_text: string };
      };
      results.push({
        name: `get_feed_by_slug("${popperSlug}")`,
        ok: Number(parsed.feed.id) === popperPostId,
        detail: `id=${parsed.feed.id}`,
      });
    } catch (err) {
      results.push({
        name: `get_feed_by_slug("${popperSlug}")`,
        ok: false,
        detail: String(err),
      });
    }
  } else {
    results.push({
      name: "get_feed_by_slug",
      ok: false,
      detail: "skipped — pas de slug",
    });
  }

  // 6. list_feed_comments
  if (popperPostId !== null) {
    try {
      const r = await listFeedCommentsTool.handler(
        { feed_id: popperPostId, per_page: 5 },
        client,
      );
      const parsed = JSON.parse(r.content[0]!.text) as { count: number };
      results.push({
        name: `list_feed_comments(${popperPostId})`,
        ok: parsed.count >= 0,
        detail: `${parsed.count} commentaire(s)`,
      });
    } catch (err) {
      results.push({
        name: `list_feed_comments(${popperPostId})`,
        ok: false,
        detail: String(err),
      });
    }
  } else {
    results.push({
      name: "list_feed_comments",
      ok: false,
      detail: "skipped",
    });
  }

  // 7. Bloc d'écriture — round-trip auto-nettoyant. Opt-in via FC_TEST_SPACE_SLUG.
  const testSpaceSlug = process.env.FC_TEST_SPACE_SLUG?.trim();
  if (testSpaceSlug) {
    const stamp = new Date().toISOString();
    const message = `Smoke-test MCP fluent-community — ${stamp}\n\nCe post est généré automatiquement pour valider la chaîne create → update → comment → react → delete. Il sera supprimé immédiatement.`;
    let createdId: number | null = null;
    let createdCommentId: number | null = null;

    // 7a. create_feed
    try {
      const r = await createFeedTool.handler(
        { message, space: testSpaceSlug, title: `Smoke-test ${stamp}` },
        client,
      );
      const parsed = JSON.parse(r.content[0]!.text) as {
        feed: { id: number | null; permalink: string | null };
        server_message: string | null;
      };
      createdId = parsed.feed.id ? Number(parsed.feed.id) : null;
      results.push({
        name: `create_feed("${testSpaceSlug}")`,
        ok: createdId !== null && Number.isFinite(createdId),
        detail: createdId
          ? `post #${createdId} créé — ${parsed.feed.permalink ?? "(pas de permalink)"}`
          : `réponse sans id : ${parsed.server_message ?? "(message vide)"}`,
      });
    } catch (err) {
      results.push({
        name: `create_feed("${testSpaceSlug}")`,
        ok: false,
        detail: String(err),
      });
    }

    // 7b. round-trip get_feed_by_id
    if (createdId !== null) {
      try {
        const r = await getFeedByIdTool.handler({ id: createdId }, client);
        const parsed = JSON.parse(r.content[0]!.text) as {
          feed: { id: number | null; content_text: string };
        };
        const ok =
          parsed.feed.id !== null &&
          Number(parsed.feed.id) === createdId &&
          parsed.feed.content_text.includes("Smoke-test");
        results.push({
          name: `roundtrip get_feed_by_id(${createdId})`,
          ok,
          detail: ok
            ? `relu OK (${parsed.feed.content_text.length} chars)`
            : `mismatch id=${parsed.feed.id}`,
        });
      } catch (err) {
        results.push({
          name: `roundtrip get_feed_by_id(${createdId})`,
          ok: false,
          detail: String(err),
        });
      }
    }

    // 7c. update_feed
    if (createdId !== null) {
      try {
        const r = await updateFeedTool.handler(
          {
            feed_id: createdId,
            message: `${message}\n\n(édité par le smoke-test à ${new Date().toISOString()})`,
          },
          client,
        );
        const parsed = JSON.parse(r.content[0]!.text) as {
          feed: { id: number | null };
          server_message: string | null;
        };
        results.push({
          name: `update_feed(${createdId})`,
          ok: parsed.feed.id !== null && Number(parsed.feed.id) === createdId,
          detail: parsed.server_message ?? "édité",
        });
      } catch (err) {
        results.push({
          name: `update_feed(${createdId})`,
          ok: false,
          detail: String(err),
        });
      }
    }

    // 7d. create_comment
    if (createdId !== null) {
      try {
        const r = await createCommentTool.handler(
          {
            feed_id: createdId,
            message: `Commentaire de smoke-test — ${new Date().toISOString()}`,
          },
          client,
        );
        const parsed = JSON.parse(r.content[0]!.text) as {
          comment: { id: number | null };
          server_message: string | null;
        };
        createdCommentId = parsed.comment.id
          ? Number(parsed.comment.id)
          : null;
        results.push({
          name: `create_comment(${createdId})`,
          ok: createdCommentId !== null,
          detail: createdCommentId
            ? `commentaire #${createdCommentId} créé`
            : `réponse sans id : ${parsed.server_message ?? "(vide)"}`,
        });
      } catch (err) {
        results.push({
          name: `create_comment(${createdId})`,
          ok: false,
          detail: String(err),
        });
      }
    }

    // 7e. react (post) — note : l'auteur du post peut être bloqué côté plugin
    //     pour réagir à son propre contenu (`disable_self_post_react`).
    //     On laisse passer un échec gracieux sans casser la suite.
    if (createdId !== null) {
      try {
        const r = await reactTool.handler(
          { target: "post", feed_id: createdId, action: "add" },
          client,
        );
        const parsed = JSON.parse(r.content[0]!.text) as {
          server_message: string | null;
          new_count: number | null;
        };
        results.push({
          name: `react(post=${createdId}, add)`,
          ok: true,
          detail: `${parsed.server_message ?? "ok"} (count=${parsed.new_count ?? "?"})`,
        });
      } catch (err) {
        results.push({
          name: `react(post=${createdId}, add)`,
          ok: false,
          detail: String(err),
        });
      }
    }

    // 7f. delete_comment (nettoyage)
    if (createdId !== null && createdCommentId !== null) {
      try {
        const r = await deleteCommentTool.handler(
          { feed_id: createdId, comment_id: createdCommentId },
          client,
        );
        const parsed = JSON.parse(r.content[0]!.text) as {
          deleted: boolean;
          server_message: string | null;
        };
        results.push({
          name: `delete_comment(${createdCommentId})`,
          ok: parsed.deleted === true,
          detail: parsed.server_message ?? "supprimé",
        });
      } catch (err) {
        results.push({
          name: `delete_comment(${createdCommentId})`,
          ok: false,
          detail: String(err),
        });
      }
    }

    // 7g. delete_feed (nettoyage) — toujours tenté si on a un id
    if (createdId !== null) {
      try {
        const r = await deleteFeedTool.handler(
          { feed_id: createdId },
          client,
        );
        const parsed = JSON.parse(r.content[0]!.text) as {
          deleted: boolean;
          server_message: string | null;
        };
        results.push({
          name: `delete_feed(${createdId})`,
          ok: parsed.deleted === true,
          detail: parsed.server_message ?? "supprimé",
        });
      } catch (err) {
        results.push({
          name: `delete_feed(${createdId})`,
          ok: false,
          detail: `ATTENTION : nettoyage échoué — post #${createdId} resté en place. ${err}`,
        });
      }
    }
  } else {
    results.push({
      name: "écriture (round-trip)",
      ok: true,
      detail:
        "skipped (opt-in) — définir FC_TEST_SPACE_SLUG pour activer l'écriture",
    });
  }

  // Rapport
  console.log("\n=== Smoke test : mcp-fluent-community ===");
  for (const r of results) {
    console.log(`${r.ok ? "OK  " : "FAIL"}  ${r.name}  —  ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} OK\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});
