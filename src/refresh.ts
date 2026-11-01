import { enrich, scrapeTrending } from "./scrape";
import { getTrendingStats, saveSnapshot, type TrendingStats } from "./history";
import type { Snapshot } from "./types";

// KV key of the published snapshot
export const KEY = "latest";
// GitHub lists about 13–25 repos. Fewer than this means the markup changed under us.
const MIN_REPOS = 5;
// The cron runs every 4 hours. A scheduled run sooner than this after the last scrape is a
// stray trigger (an old schedule can keep firing after a change), so it does nothing.
export const MIN_CRON_INTERVAL_MS = 60 * 60 * 1000;

export interface RefreshResult {
	snapshot: Snapshot;
	// Set when D1 failed. The snapshot is still published, without badges
	historyError: string | null;
}

export async function refresh(env: Env): Promise<RefreshResult> {
	const scraped = await scrapeTrending();
	// Throwing keeps the old data in KV and makes the failure show up in logs and /__refresh
	checkScrape(scraped.length, scraped.filter((r) => r.starsToday > 0).length);

	const repos = await enrich(scraped, env.GITHUB_TOKEN || undefined);
	const snapshot: Snapshot = { fetchedAt: new Date().toISOString(), repos };

	// History is a bonus: if D1 fails, still publish the fresh list without badges,
	// but report the error so the cron run fails and the health check sees it
	let historyError: string | null = null;
	try {
		await saveSnapshot(env.DB, snapshot);
		addHistory(snapshot, await getTrendingStats(env.DB, snapshot.fetchedAt));
	} catch (err) {
		console.error("history:", err);
		historyError = String(err);
	}

	// A slower overlapping refresh (cron and manual) mustn't replace newer data
	const current = await env.TRENDING.get<Snapshot>(KEY, "json");
	if (current && current.fetchedAt > snapshot.fetchedAt) {
		console.warn(`refresh: KV already has ${current.fetchedAt}, not writing ${snapshot.fetchedAt}`);
		return { snapshot: current, historyError };
	}
	await env.TRENDING.put(KEY, JSON.stringify(snapshot));
	return { snapshot, historyError };
}

export function checkScrape(total: number, withStarsToday: number): void {
	if (total < MIN_REPOS) throw new Error(`scrape found ${total} repos (expected at least ${MIN_REPOS}); check selectors in src/scrape.ts`);
	if (withStarsToday === 0) throw new Error("scrape found no stars-today counts; check selectors in src/scrape.ts");
}

export function addHistory(snapshot: Snapshot, stats: TrendingStats): void {
	const today = snapshot.fetchedAt.slice(0, 10);
	snapshot.repos.forEach((repo, i) => {
		const rank = i + 1;
		repo.daysTrending = stats.days.get(rank);
		// Without yesterday's data, "first seen today" may only mean we weren't looking
		repo.isNew = stats.scrapedYesterday && stats.firstSeen.get(rank) === today;
	});
}
