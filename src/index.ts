import { enrich, scrapeTrending } from "./scrape";
import { renderPage } from "./render";
import { getTrendingStats, saveSnapshot, type TrendingStats } from "./history";
import type { Snapshot } from "./types";

const KEY = "latest";

async function refresh(env: Env): Promise<Snapshot> {
	const repos = await enrich(await scrapeTrending(), env.GITHUB_TOKEN);
	const snapshot: Snapshot = { fetchedAt: new Date().toISOString(), repos };
	// Don't overwrite good data if GitHub changed its markup and we parsed nothing
	if (repos.length === 0) return snapshot;

	// History is a bonus: if D1 fails, still publish the fresh list without badges
	try {
		await saveSnapshot(env.DB, snapshot);
		addHistory(snapshot, await getTrendingStats(env.DB, snapshot.fetchedAt));
	} catch (err) {
		console.error("history:", err);
	}

	await env.TRENDING.put(KEY, JSON.stringify(snapshot));
	return snapshot;
}

function addHistory(snapshot: Snapshot, stats: TrendingStats): void {
	const today = snapshot.fetchedAt.slice(0, 10);
	const trackedBeforeToday = stats.trackingSince !== null && stats.trackingSince < today;
	for (const repo of snapshot.repos) {
		const key = `${repo.owner}/${repo.name}`;
		repo.daysTrending = stats.days.get(key);
		repo.isNew = trackedBeforeToday && stats.firstSeen.get(key) === today;
	}
}

export default {
	async fetch(request, env) {
		const { pathname } = new URL(request.url);

		// Manual scrape, e.g. right after a deploy: POST with `authorization: Bearer <REFRESH_KEY>`
		if (pathname === "/__refresh" && request.method === "POST") {
			if (!env.REFRESH_KEY || request.headers.get("authorization") !== `Bearer ${env.REFRESH_KEY}`) {
				return new Response("Unauthorized", { status: 401 });
			}
			try {
				const result = await refresh(env);
				return Response.json({ fetchedAt: result.fetchedAt, repos: result.repos.length });
			} catch (err) {
				return Response.json({ error: String(err) }, { status: 500 });
			}
		}
		const snapshot = await env.TRENDING.get<Snapshot>(KEY, "json");
		if (pathname === "/api/trending") {
			return Response.json(snapshot ?? { fetchedAt: null, repos: [] });
		}
		if (pathname === "/") {
			return new Response(renderPage(snapshot), {
				headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
			});
		}
		return new Response("Not found", { status: 404 });
	},

	async scheduled(_controller, env, ctx) {
		ctx.waitUntil(refresh(env));
	},
} satisfies ExportedHandler<Env>;
