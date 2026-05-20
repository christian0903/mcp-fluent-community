# mcp-fluent-community

Serveur **MCP (Model Context Protocol)** en lecture seule pour [Fluent Community](https://fluentcommunity.co/) — expose les espaces, les posts (`feeds`) et les commentaires d'une instance WordPress à un client MCP (Claude Desktop, Claude Code, etc.).

Cas d'usage : retrouver, citer et travailler depuis Claude le contenu publié dans une communauté Fluent Community que vous opérez ou dont vous êtes membre administrateur.

> Statut : **v0.1.0** — 6 outils MVP en lecture seule. Pas d'écriture, pas de modération.

---

## Démarrage rapide (5 minutes)

Si vous avez déjà Node 20+, un site WordPress avec Fluent Community, et un Application Password sous la main :

```bash
# 1. Cloner et installer
git clone https://github.com/christian0903/mcp-fluent-community.git
cd mcp-fluent-community
npm install
npm run build

# 2. Configurer
cp .env.example .env
# Éditez .env avec votre site, votre login WP et votre Application Password

# 3. Valider
npx tsx scripts/smoke-test.ts
# Sortie attendue : 6/6 OK

# 4. Brancher dans Claude Code (chemin absolu obligatoire)
claude mcp add fluent-community \
  --scope user \
  -e FC_SITE_URL=https://votre-site.tld \
  -e FC_USERNAME=votre-login-wp \
  -e FC_APP_PASSWORD="xxxx xxxx xxxx xxxx xxxx xxxx" \
  -- node "$(pwd)/dist/index.js"
```

Puis redémarrez votre session Claude — les outils apparaissent en `mcp__fluent-community__*`.

> Vous n'avez jamais utilisé d'Application Password WordPress ? Voyez la section [Créer un Application Password](#créer-un-application-password) plus bas.

---

## Outils exposés

| Outil MCP | Endpoint REST sous-jacent | Description |
|---|---|---|
| `list_spaces` | `GET /spaces` | Énumère les espaces (groupes / catégories) |
| `search_feeds` | `GET /feeds?search=...` | Recherche full-text dans les posts (accents FR OK) |
| `list_feeds` | `GET /feeds?space_id=...&page=...` | Liste paginée des posts, filtrable par espace |
| `get_feed_by_id` | `GET /feeds/{id}/by-id` | Lit un post complet par ID |
| `get_feed_by_slug` | `GET /feeds/{slug}/by-slug` | Lit un post complet par slug |
| `list_feed_comments` | `GET /feeds/{id}/comments` | Liste les commentaires d'un post |

Tous les outils renvoient une **projection résumée** (id, titre, slug, auteur, espace, dates, permalink, contenu HTML, contenu strippé en texte) plutôt que la réponse brute de l'API — pour faciliter la lecture par le modèle.

---

## Prérequis

- **Node.js 20+** (l'auteur teste sous Node 25).
- Un site WordPress avec le plugin **Fluent Community** installé et activé.
- Un compte WordPress administrateur, et un **WordPress Application Password** créé pour ce compte.

### Créer un Application Password

1. Connectez-vous à l'admin WordPress.
2. Allez dans **Utilisateurs → Profil**.
3. Section **Mots de passe d'application** : donnez un nom (par exemple `MCP Fluent Community`) et cliquez sur **Ajouter**.
4. WordPress affiche un mot de passe de la forme `xxxx xxxx xxxx xxxx xxxx xxxx`. **Copiez-le immédiatement** — il n'est plus affiché ensuite.
5. Notez aussi votre identifiant WordPress (`username`, pas l'email).

---

## Installation

```bash
git clone https://github.com/christian0903/mcp-fluent-community.git
cd mcp-fluent-community
npm install
cp .env.example .env
# Éditez .env avec vos vraies valeurs
npm run build
```

### Variables d'environnement

Le fichier `.env` (gitignored) doit contenir :

```env
FC_SITE_URL=https://votre-site.tld
FC_USERNAME=votre-login-wp
FC_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

Les espaces dans `FC_APP_PASSWORD` sont **conservés tels quels** — WordPress les accepte.

---

## Tester l'installation

Un smoke test valide les 6 outils contre l'instance configurée :

```bash
npx tsx scripts/smoke-test.ts
```

Sortie attendue (exemple) :

```
=== Smoke test : mcp-fluent-community ===
OK    list_spaces  —  N espace(s)
OK    search_feeds("popper")  —  post #250 trouvé, slug=...
OK    list_feeds  —  3 posts (total=N)
OK    get_feed_by_id(250)  —  XXXX chars texte strippé
OK    get_feed_by_slug("...")  —  id=250
OK    list_feed_comments(250)  —  N commentaire(s)

6/6 OK
```

---

## Brancher le serveur dans Claude Code

Le moyen le plus simple :

```bash
claude mcp add fluent-community \
  --scope user \
  -e FC_SITE_URL=https://votre-site.tld \
  -e FC_USERNAME=votre-login-wp \
  -e FC_APP_PASSWORD="xxxx xxxx xxxx xxxx xxxx xxxx" \
  -- node /chemin/absolu/vers/mcp-fluent-community/dist/index.js
```

> **N'oubliez pas** : `npm run build` avant le premier `claude mcp add` (le script appelle `dist/index.js`, qui n'existe qu'après la build).
>
> **Sécurité** : ne committez jamais votre Application Password dans un dépôt Git, même privé. Utilisez `.env` (gitignored par défaut dans ce repo).

Vérifier l'ajout :

```bash
claude mcp list
```

Puis dans une session Claude Code, les outils apparaissent préfixés `mcp__fluent-community__*`.

---

## Brancher le serveur dans Claude Desktop

Éditer `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) ou l'équivalent sur votre OS, et ajouter :

```json
{
  "mcpServers": {
    "fluent-community": {
      "command": "node",
      "args": ["/chemin/absolu/vers/mcp-fluent-community/dist/index.js"],
      "env": {
        "FC_SITE_URL": "https://votre-site.tld",
        "FC_USERNAME": "votre-login-wp",
        "FC_APP_PASSWORD": "xxxx xxxx xxxx xxxx xxxx xxxx"
      }
    }
  }
}
```

Puis **redémarrer Claude Desktop**.

---

## Exemples d'usage dans Claude

Une fois le MCP branché, vous pouvez écrire dans une conversation Claude :

- « Liste les espaces de la community. »
- « Cherche-moi le post sur Popper et la réfutation. »
- « Lis le post #250 et résume-le en 5 points. »
- « Combien de commentaires sur le post 250 ? Donne-moi le dernier. »

---

## Architecture

```
src/
  index.ts            — point d'entrée serveur MCP (STDIO)
  config.ts           — chargement env vars
  client.ts           — wrapper HTTP Basic Auth → API REST FC v2
  format.ts           — projections (summarizeFeed/Space/Comment) + stripHtml
  tools/
    list_spaces.ts
    search_feeds.ts
    list_feeds.ts
    get_feed_by_id.ts
    get_feed_by_slug.ts
    list_feed_comments.ts
scripts/
  smoke-test.ts       — validation E2E des 6 outils contre la vraie API
```

### Particularités de l'API Fluent Community

- Le contenu d'un post est dans `message_rendered` (HTML), pas `message`. Le serveur expose les deux : `content_html` (brut) et `content_text` (strippé).
- Structure de réponse listings : `{ feeds: { data: [...], total: N }, sticky: [...], execution_time }`.
- Structure de réponse unitaires : `{ feed: {...}, execution_time }`.
- Auteur : `feed.xprofile.display_name` / `feed.xprofile.username`.
- Espace : `feed.space.title` / `feed.space.slug`.
- Permalink : `feed.permalink` (déjà absolu, ne pas reconstruire).

---

## Dépannage

### `401 Unauthorized` sur tous les appels

- Vérifiez que `FC_USERNAME` est bien votre **identifiant** WordPress (`user_login`), pas votre email.
- Vérifiez que `FC_APP_PASSWORD` contient les **espaces** affichés par WordPress (`xxxx xxxx xxxx xxxx xxxx xxxx`) — ils font partie du password.
- L'Application Password a peut-être été révoqué : créez-en un nouveau.

### `404 Not Found` sur `/wp-json/fluent-community/v2/feeds`

- Le plugin Fluent Community n'est pas installé ou pas activé sur le site cible.
- Confirmez en ouvrant `https://votre-site.tld/wp-json/` dans un navigateur : vous devez voir `fluent-community/v2` dans la liste `namespaces`.

### `npm run build` échoue avec des erreurs TypeScript

- Vérifiez votre version de Node : `node --version` doit afficher `v20.x` ou plus.
- Supprimez `node_modules` et `package-lock.json`, puis relancez `npm install`.

### `search_feeds` ne renvoie rien

- La recherche Fluent Community utilise le `LIKE` MySQL — essayez des mots-clés plus simples ou partiels.
- Vérifiez que le post est **publié** (pas brouillon) et dans un espace auquel votre utilisateur a accès.
- Les espaces privés ne renvoient des résultats que si l'utilisateur du Application Password en est membre.

### Claude ne voit pas les outils

- Lancez `claude mcp list` pour confirmer l'enregistrement.
- Redémarrez votre session Claude (fermez complètement l'app et rouvrez).
- Vérifiez que `dist/index.js` existe (a-t-on bien lancé `npm run build` ?).
- Le chemin passé à `claude mcp add` doit être **absolu**, pas relatif.

### Le `-e FC_APP_PASSWORD="..."` ne marche pas dans mon shell

- Sous zsh / bash, les espaces dans la valeur **doivent** être protégés par des guillemets doubles.
- Évitez d'utiliser les guillemets simples : ils empêchent certaines substitutions.

---

## Roadmap

- **v0.1** (cette version) : 6 outils MVP en lecture seule.
- **v0.2** : intégration Obsidian (export d'un post en note vault) — backlog.
- **v0.3** : recherche multi-espace, filtres par auteur / date — selon besoin.

L'écriture (création de post, commentaire, modération) n'est pas prévue — par choix de sécurité.

---

## Licence

MIT — voir [LICENSE](./LICENSE).

## Auteur

Christian Vanhenten — [atelierpnl.eu](https://atelierpnl.eu).
