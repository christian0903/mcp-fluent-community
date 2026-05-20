#!/usr/bin/env node
/**
 * Serveur MCP — Fluent Community.
 *
 * Démarre un serveur MCP qui expose 12 outils :
 *   - lecture (6) : list_spaces, search_feeds, list_feeds,
 *     get_feed_by_id, get_feed_by_slug, list_feed_comments
 *   - écriture (6) : create_feed, update_feed, delete_feed,
 *     create_comment, delete_comment, react
 * via STDIO, pour usage dans Claude Desktop, Claude Code ou tout client MCP.
 *
 * Configuration via variables d'environnement (voir .env.example) :
 *   FC_SITE_URL, FC_USERNAME, FC_APP_PASSWORD
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { FluentCommunityClient } from "./client.js";

import { listSpacesTool } from "./tools/list_spaces.js";
import { searchFeedsTool } from "./tools/search_feeds.js";
import { listFeedsTool } from "./tools/list_feeds.js";
import { getFeedByIdTool } from "./tools/get_feed_by_id.js";
import { getFeedBySlugTool } from "./tools/get_feed_by_slug.js";
import { listFeedCommentsTool } from "./tools/list_feed_comments.js";
import { createFeedTool } from "./tools/create_feed.js";
import { updateFeedTool } from "./tools/update_feed.js";
import { deleteFeedTool } from "./tools/delete_feed.js";
import { createCommentTool } from "./tools/create_comment.js";
import { deleteCommentTool } from "./tools/delete_comment.js";
import { reactTool } from "./tools/react.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new FluentCommunityClient(config);

  const server = new McpServer({
    name: "mcp-fluent-community",
    version: "0.1.0",
  });

  // Enregistrement des 12 outils. On adapte la signature attendue
  // par McpServer.registerTool : (args) => Promise<{content: ...}>.
  server.registerTool(
    listSpacesTool.name,
    listSpacesTool.config,
    async () => listSpacesTool.handler({}, client),
  );

  server.registerTool(
    searchFeedsTool.name,
    searchFeedsTool.config,
    async (args) => searchFeedsTool.handler(args as never, client),
  );

  server.registerTool(
    listFeedsTool.name,
    listFeedsTool.config,
    async (args) => listFeedsTool.handler(args as never, client),
  );

  server.registerTool(
    getFeedByIdTool.name,
    getFeedByIdTool.config,
    async (args) => getFeedByIdTool.handler(args as never, client),
  );

  server.registerTool(
    getFeedBySlugTool.name,
    getFeedBySlugTool.config,
    async (args) => getFeedBySlugTool.handler(args as never, client),
  );

  server.registerTool(
    listFeedCommentsTool.name,
    listFeedCommentsTool.config,
    async (args) => listFeedCommentsTool.handler(args as never, client),
  );

  server.registerTool(
    createFeedTool.name,
    createFeedTool.config,
    async (args) => createFeedTool.handler(args as never, client),
  );

  server.registerTool(
    updateFeedTool.name,
    updateFeedTool.config,
    async (args) => updateFeedTool.handler(args as never, client),
  );

  server.registerTool(
    deleteFeedTool.name,
    deleteFeedTool.config,
    async (args) => deleteFeedTool.handler(args as never, client),
  );

  server.registerTool(
    createCommentTool.name,
    createCommentTool.config,
    async (args) => createCommentTool.handler(args as never, client),
  );

  server.registerTool(
    deleteCommentTool.name,
    deleteCommentTool.config,
    async (args) => deleteCommentTool.handler(args as never, client),
  );

  server.registerTool(
    reactTool.name,
    reactTool.config,
    async (args) => reactTool.handler(args as never, client),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Pas de console.log — STDIO sert au protocole MCP.
  process.stderr.write(
    `[mcp-fluent-community] server connected — site=${config.siteUrl} user=${config.username}\n`,
  );
}

main().catch((err) => {
  process.stderr.write(
    `[mcp-fluent-community] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
