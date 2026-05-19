/**
 * Configuration du serveur MCP Fluent Community.
 *
 * Toutes les valeurs sensibles passent par variables d'environnement.
 * Aucune valeur de credentials n'est codée en dur — interdit dans ce repo.
 */

export interface FluentCommunityConfig {
  /** Base URL du site WordPress, sans slash final. Ex : https://atelierpnl.eu */
  siteUrl: string;
  /** Login WordPress (administrateur capable de lire la Community). */
  username: string;
  /**
   * WordPress Application Password (format `xxxx xxxx xxxx xxxx xxxx xxxx`).
   * Stocké tel quel — les espaces sont autorisés par WordPress.
   */
  appPassword: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Voir .env.example.`,
    );
  }
  return value.trim();
}

export function loadConfig(): FluentCommunityConfig {
  const siteUrl = requireEnv("FC_SITE_URL").replace(/\/+$/, "");
  const username = requireEnv("FC_USERNAME");
  const appPassword = requireEnv("FC_APP_PASSWORD");
  return { siteUrl, username, appPassword };
}
