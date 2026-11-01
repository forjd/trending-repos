import { isStale, renderPage, timeAgo } from "./render";
import { KEY, MIN_CRON_INTERVAL_MS, refresh } from "./refresh";
import { pingHealthcheck } from "./health";
import { authorized, etagMatches } from "./http";
import type { Snapshot } from "./types";

// The main module exports only the handler: workerd rejects other exports that aren't
// entrypoints, so helpers live in their own modules.

const SECURITY_HEADERS = {
	"content-security-policy":
		"default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; " +
		"img-src https://avatars.githubusercontent.com https://github.com data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
	"x-content-type-options": "nosniff",
	"referrer-policy": "strict-origin-when-cross-origin",
};
// Short, so "updated N min ago" stays close; repeat visits revalidate cheaply with the ETag
const CACHE_CONTROL = "public, max-age=60";

function methodNotAllowed(allow: string): Response {
	return new Response("Method not allowed", { status: 405, headers: { allow } });
}

export default {
	async fetch(request, env) {
		const { pathname } = new URL(request.url);

		// Manual scrape, e.g. right after a deploy: POST with `authorization: Bearer <REFRESH_KEY>`
		if (pathname === "/__refresh") {
			if (request.method !== "POST") return methodNotAllowed("POST");
			if (!(await authorized(request, env.REFRESH_KEY))) {
				return new Response("Unauthorized", { status: 401 });
			}
			try {
				const { snapshot, historyError } = await refresh(env);
				return Response.json({
					fetchedAt: snapshot.fetchedAt,
					repos: snapshot.repos.length,
					history: historyError === null ? "ok" : `failed: ${historyError}`,
				});
			} catch (err) {
				console.error("refresh:", err);
				return Response.json({ error: String(err) }, { status: 502 });
			}
		}

		if (pathname !== "/" && pathname !== "/api/trending") {
			return new Response("Not found", { status: 404 });
		}
		if (request.method !== "GET" && request.method !== "HEAD") return methodNotAllowed("GET, HEAD");

		// cacheTtl lets each location keep the value for a minute instead of reading KV every time
		const snapshot = await env.TRENDING.get<Snapshot>(KEY, { type: "json", cacheTtl: 60 });
		// The page shows "updated N min ago" and maybe a stale notice, so its ETag changes with them
		const version = snapshot?.fetchedAt ?? "empty";
		const now = new Date();
		const pageState = snapshot ? `-${timeAgo(snapshot.fetchedAt, now)}${isStale(snapshot.fetchedAt, now) ? "-stale" : ""}` : "";
		const etag = pathname === "/" ? `"${version}${pageState}"` : `"${version}"`;
		const headers: Record<string, string> = { "cache-control": CACHE_CONTROL, etag };
		if (snapshot) headers["last-modified"] = new Date(snapshot.fetchedAt).toUTCString();

		if (etagMatches(request.headers.get("if-none-match"), etag)) {
			return new Response(null, { status: 304, headers });
		}
		if (pathname === "/api/trending") {
			return Response.json(snapshot ?? { fetchedAt: null, repos: [] }, { headers });
		}
		return new Response(renderPage(snapshot, now), {
			headers: { ...headers, ...SECURITY_HEADERS, "content-type": "text/html; charset=utf-8" },
		});
	},

	async scheduled(controller, env) {
		const current = await env.TRENDING.get<Snapshot>(KEY, "json");
		if (current && controller.scheduledTime - Date.parse(current.fetchedAt) < MIN_CRON_INTERVAL_MS) {
			console.warn(`scheduled: last scrape was ${current.fetchedAt}, skipping (cron "${controller.cron}")`);
			// The data is fresh, so report how that scrape went. A snapshot published after a D1
			// failure has no badge stats, and a success ping here would clear that failure
			const historySaved = current.repos.some((r) => r.daysTrending !== undefined);
			await pingHealthcheck(
				env.HEALTHCHECK_URL || undefined,
				historySaved ? undefined : `last scrape (${current.fetchedAt}) was published without history`,
			);
			return;
		}
		// Awaited, not waitUntil, so a failed refresh marks the cron run as failed
		try {
			const { historyError } = await refresh(env);
			if (historyError !== null) throw new Error(`published the scrape, but history failed: ${historyError}`);
		} catch (err) {
			await pingHealthcheck(env.HEALTHCHECK_URL || undefined, String(err));
			throw err;
		}
		await pingHealthcheck(env.HEALTHCHECK_URL || undefined);
	},
} satisfies ExportedHandler<Env>;
