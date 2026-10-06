import { enrich, scrapeTrending } from "./scrape";
import { renderPage, timeAgo } from "./render";
import { getTrendingStats, saveSnapshot, type TrendingStats } from "./history";
import type { Snapshot } from "./types";

const KEY = "latest";
// GitHub lists about 13–25 repos. Fewer than this means the markup changed under us.
const MIN_REPOS = 5;
// The cron runs every 4 hours. A scheduled run sooner than this after the last scrape is a
// stray trigger (an old schedule can keep firing after a change), so it does nothing.
export const MIN_CRON_INTERVAL_MS = 60 * 60 * 1000;

const SECURITY_HEADERS = {
	"content-security-policy":
		"default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
		"img-src https://avatars.githubusercontent.com https://github.com data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
	"x-content-type-options": "nosniff",
	"referrer-policy": "strict-origin-when-cross-origin",
};
// Short, so "updated N min ago" stays close; repeat visits revalidate cheaply with the ETag
const CACHE_CONTROL = "public, max-age=60";

export async function refresh(env: Env): Promise<Snapshot> {
	const scraped = await scrapeTrending();
	// Throwing keeps the old data in KV and makes the failure show up in logs and /__refresh
	checkScrape(scraped.length, scraped.filter((r) => r.starsToday > 0).length);

	const repos = await enrich(scraped, env.GITHUB_TOKEN || undefined);
	const snapshot: Snapshot = { fetchedAt: new Date().toISOString(), repos };

	// History is a bonus: if D1 fails, still publish the fresh list without badges
	try {
		await saveSnapshot(env.DB, snapshot);
		addHistory(snapshot, await getTrendingStats(env.DB, snapshot.fetchedAt));
	} catch (err) {
		console.error("history:", err);
	}

	// A slower overlapping refresh (cron and manual) mustn't replace newer data
	const current = await env.TRENDING.get<Snapshot>(KEY, "json");
	if (current && current.fetchedAt > snapshot.fetchedAt) {
		console.warn(`refresh: KV already has ${current.fetchedAt}, not writing ${snapshot.fetchedAt}`);
		return current;
	}
	await env.TRENDING.put(KEY, JSON.stringify(snapshot));
	return snapshot;
}

export function checkScrape(total: number, withStarsToday: number): void {
	if (total < MIN_REPOS) throw new Error(`scrape found ${total} repos (expected at least ${MIN_REPOS}); check selectors in src/scrape.ts`);
	if (withStarsToday === 0) throw new Error("scrape found no stars-today counts; check selectors in src/scrape.ts");
}

export function addHistory(snapshot: Snapshot, stats: TrendingStats): void {
	const today = snapshot.fetchedAt.slice(0, 10);
	const trackedBeforeToday = stats.trackingSince !== null && stats.trackingSince < today;
	snapshot.repos.forEach((repo, i) => {
		const rank = i + 1;
		repo.daysTrending = stats.days.get(rank);
		repo.isNew = trackedBeforeToday && stats.firstSeen.get(rank) === today;
	});
}

async function authorized(request: Request, key: string | undefined): Promise<boolean> {
	if (!key) return false;
	const given = request.headers.get("authorization") ?? "";
	// Hash both so the lengths match, then compare in constant time
	const [a, b] = await Promise.all(
		[given, `Bearer ${key}`].map((s) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))),
	);
	return crypto.subtle.timingSafeEqual(a, b);
}

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
				const result = await refresh(env);
				return Response.json({ fetchedAt: result.fetchedAt, repos: result.repos.length });
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
		// The page shows "updated N min ago", so its ETag changes when that text does
		const version = snapshot?.fetchedAt ?? "empty";
		const etag = pathname === "/" ? `"${version}-${snapshot ? timeAgo(snapshot.fetchedAt, new Date()) : ""}"` : `"${version}"`;
		const headers: Record<string, string> = { "cache-control": CACHE_CONTROL, etag };
		if (snapshot) headers["last-modified"] = new Date(snapshot.fetchedAt).toUTCString();

		if (request.headers.get("if-none-match") === etag) {
			return new Response(null, { status: 304, headers });
		}
		if (pathname === "/api/trending") {
			return Response.json(snapshot ?? { fetchedAt: null, repos: [] }, { headers });
		}
		return new Response(renderPage(snapshot), {
			headers: { ...headers, ...SECURITY_HEADERS, "content-type": "text/html; charset=utf-8" },
		});
	},

	async scheduled(controller, env) {
		const current = await env.TRENDING.get<Snapshot>(KEY, "json");
		if (current && controller.scheduledTime - Date.parse(current.fetchedAt) < MIN_CRON_INTERVAL_MS) {
			console.warn(`scheduled: last scrape was ${current.fetchedAt}, skipping (cron "${controller.cron}")`);
			return;
		}
		// Awaited, not waitUntil, so a failed refresh marks the cron run as failed
		await refresh(env);
	},
} satisfies ExportedHandler<Env>;
