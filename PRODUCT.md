# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Public developers who want a better view of GitHub trending than github.com/trending gives. A first-time visitor must understand the page without explanation. Typical visit: a quick check, often on a phone or between tasks, to see what is gaining stars and what is new.

## Product Purpose

trending-repos scrapes github.com/trending every 4 hours, enriches each repo from the GitHub REST API, and keeps a history in D1. A visit must give two things at once: today's trending list with star gains, easy to scan, and a clear view of which repos are new today and which keep trending across days.

Success: a visitor finds something worth opening within a few seconds, and can tell a one-day spike from a repo with staying power.

## Positioning

GitHub's own trending page shows only today. This site remembers. Each repo carries history from D1 (first seen, distinct days trending, a "new today" signal), so the page can show momentum and persistence, which github.com/trending cannot.

## Operating Context

- Data refreshes every 4 hours (cron), so the page is a snapshot with a known age.
- Page loads read one KV snapshot. D1 is queried only during a scrape, so any history the page shows must be computed at scrape time and stored on the snapshot.
- The same snapshot is public JSON at `/api/trending`.

## Capabilities and Constraints

- Per repo: owner, name, URL, description, language and colour, total stars, forks, stars today, avatar, and when the API lookup works: numeric id, topics, homepage. From history: `daysTrending`, `isNew`.
- About 25 repos per snapshot (whatever github.com/trending lists for the daily range).
- API enrichment can fail or be rate limited; topics, homepage and id can be missing on any repo. Design must hold up without them.
- Rendered server-side in a Cloudflare Worker from one template (`src/render.ts`). Client-side JavaScript is allowed where it helps; there is no requirement to stay JS-free. The page's CSP (`src/index.ts`) has no `script-src` today, so adding a script means changing the CSP first.
- Follows the system light/dark preference today.
- History starts on 2026-10-05.

## Brand Commitments

- Name in use: "Trending Repos" (page title); domain trending.ddewhurst.com.
- Not affiliated with GitHub. Data credit to github.com/trending must stay.
- Open source (MIT, `forjd/trending-repos`).

## Evidence on Hand

- Live data: the KV snapshot at `/api/trending`, and `test/fixtures/trending.html`.
- No testimonials, user counts or analytics exist. Do not invent them.

## Product Principles

1. Today first, memory second: the current list is the core; history adds meaning without slowing the scan.
2. Honest freshness: always show how old the snapshot is.
3. Degrade quietly: missing API data must never look broken.
4. Fast and light: one KV read per page; nothing should make the page feel heavy.
