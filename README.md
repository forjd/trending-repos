<div align="center">

# 📈 trending-repos

**GitHub's trending page, scraped every 4 hours and served from the edge.**

Stars, forks, topics and "days trending" history, in one fast page with no client-side JavaScript.

[![Live site](https://img.shields.io/badge/live-trending--repos.danjdewhurst.workers.dev-f38020?logo=cloudflare&logoColor=white)](https://trending-repos.danjdewhurst.workers.dev)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020?logo=cloudflareworkers&logoColor=white)](https://workers.cloudflare.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

[**View it live →**](https://trending-repos.danjdewhurst.workers.dev)

</div>

---

## ✨ Features

- **Fresh every 4 hours.** A cron trigger scrapes [github.com/trending](https://github.com/trending) and publishes a new snapshot.
- **Enriched data.** Each repo is looked up on the GitHub REST API for exact counts, topics, homepage and a stable id that survives renames.
- **History badges.** Every scrape is stored in D1, so the page can show **New today** and **N days trending**.
- **Fast page loads.** Pages are rendered from a single KV read, with ETags and caching. No client JS.
- **Light and dark mode.** Follows your system setting.
- **JSON API.** The same snapshot is available at [`/api/trending`](https://trending-repos.danjdewhurst.workers.dev/api/trending).
- **Fails safe.** If GitHub changes its HTML and the scrape looks broken, the old data stays up.

## 🧭 How it works

```mermaid
flowchart LR
    cron["⏰ Cron<br/>every 4h"] --> scrape
    manual["POST /__refresh"] --> scrape
    scrape["Scrape<br/>github.com/trending"] --> check{"Looks<br/>healthy?"}
    check -- no --> keep["Keep old data"]
    check -- yes --> enrich["Enrich via<br/>GitHub API"]
    enrich --> d1[("D1<br/>history")]
    d1 --> kv[("KV<br/>latest snapshot")]
    kv --> page["GET /<br/>HTML page"]
    kv --> api["GET /api/trending<br/>JSON"]
```

Page loads only touch KV. D1 is written and queried only during a scrape.

| Route | Returns |
|---|---|
| `GET /` | The styled HTML page |
| `GET /api/trending` | The latest snapshot as JSON |
| `POST /__refresh` | Runs a scrape now. Needs `Authorization: Bearer <REFRESH_KEY>` |

## 🚀 Getting started

You need Node.js and a Cloudflare account.

```bash
git clone https://github.com/forjd/trending-repos.git
cd trending-repos
npm install
```

### Run locally

```bash
npm run db:migrate:local   # create the local D1 schema
npm run dev                # http://localhost:8787
curl localhost:8787/__scheduled   # trigger a scrape
```

Optional: create `.dev.vars` with a `GITHUB_TOKEN` to avoid the API's 60 requests/hour limit, and a `REFRESH_KEY` to test `/__refresh`.

```ini
REFRESH_KEY=some-long-random-string
GITHUB_TOKEN=github_pat_...
```

### Deploy your own

1. Create a KV namespace and a D1 database, and put their ids in `wrangler.jsonc`:
   ```bash
   npx wrangler kv namespace create TRENDING
   npx wrangler d1 create trending-repos
   ```
2. Apply the schema: `npm run db:migrate`
3. Set the secrets:
   ```bash
   npx wrangler secret put REFRESH_KEY
   npx wrangler secret put GITHUB_TOKEN   # optional
   ```
4. Deploy: `npm run deploy`

For `GITHUB_TOKEN`, use a fine-grained token with public read-only access and no extra permissions.

## 🧪 Development

| Command | What it does |
|---|---|
| `npm run dev` | Local server with local KV and D1 |
| `npm test` | Vitest inside the Workers runtime (network is mocked) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run types` | Regenerate `worker-configuration.d.ts` after editing `wrangler.jsonc` |

## 📁 Project layout

```
src/
  index.ts      routes, cron handler, refresh()
  scrape.ts     trending page parser + GitHub API enrichment
  history.ts    D1 writes and badge stats
  render.ts     the page: HTML and CSS in one template
  types.ts      Repo and Snapshot
test/           Vitest tests and a fixture copy of the trending page
migrations/     D1 schema
```

## 📄 License

[MIT](LICENSE) © Forjd

<div align="center">
<sub>Not affiliated with GitHub. Data comes from the public trending page and REST API.</sub>
</div>
