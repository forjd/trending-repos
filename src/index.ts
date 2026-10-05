import { enrich, scrapeTrending } from "./scrape";
import { renderPage } from "./render";
import { saveSnapshot } from "./history";
import type { Snapshot } from "./types";

const KEY = "latest";

async function refresh(env: Env): Promise<Snapshot> {
	const repos = await enrich(await scrapeTrending(), env.GITHUB_TOKEN);
	const snapshot: Snapshot = { fetchedAt: new Date().toISOString(), repos };
	// Don't overwrite good data if GitHub changed its markup and we parsed nothing
	if (repos.length === 0) return snapshot;
	await env.TRENDING.put(KEY, JSON.stringify(snapshot));
	await saveSnapshot(env.DB, snapshot);
	return snapshot;
}

export default {
	async fetch(request, env) {
		const { pathname } = new URL(request.url);
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
