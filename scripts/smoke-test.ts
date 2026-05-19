/**
 * Smoke test : valide les 6 outils MVP contre l'instance Fluent Community
 * configurée par les variables d'environnement (FC_SITE_URL, FC_USERNAME,
 * FC_APP_PASSWORD).
 *
 * Usage :
 *   tsx scripts/smoke-test.ts
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
