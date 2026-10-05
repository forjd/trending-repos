import type { Snapshot } from "./types";

// Appends a scrape to D1. The batch runs as one transaction.
export async function saveSnapshot(db: D1Database, snapshot: Snapshot): Promise<void> {
	const insert = db.prepare(
		`INSERT INTO snapshot_repos
			(fetched_at, rank, owner, name, description, language, stars, forks, stars_today, topics, homepage)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	);
	await db.batch(
		snapshot.repos.map((r, i) =>
			insert.bind(
				snapshot.fetchedAt,
				i + 1,
				r.owner,
				r.name,
				r.description,
				r.language,
				r.stars,
				r.forks,
				r.starsToday,
				r.topics ? JSON.stringify(r.topics) : null,
				r.homepage ?? null,
			),
		),
	);
}

export interface TrendingStats {
	// Distinct UTC days each repo has appeared, keyed by "owner/name"
	days: Map<string, number>;
	// First day each repo appeared (YYYY-MM-DD), keyed by "owner/name"
	firstSeen: Map<string, string>;
	// First day we have any history for (YYYY-MM-DD)
	trackingSince: string | null;
}

// History for the repos in the scrape saved at `fetchedAt`.
export async function getTrendingStats(db: D1Database, fetchedAt: string): Promise<TrendingStats> {
	const [repos, since] = await db.batch<{ owner: string; name: string; first_seen: string; days: number } | { since: string | null }>([
		db
			.prepare(
				`SELECT h.owner, h.name,
					substr(MIN(h.fetched_at), 1, 10) AS first_seen,
					COUNT(DISTINCT substr(h.fetched_at, 1, 10)) AS days
				FROM snapshot_repos h
				JOIN snapshot_repos c ON c.owner = h.owner AND c.name = h.name AND c.fetched_at = ?
				GROUP BY h.owner, h.name`,
			)
			.bind(fetchedAt),
		db.prepare(`SELECT substr(MIN(fetched_at), 1, 10) AS since FROM snapshot_repos`),
	]);

	const stats: TrendingStats = { days: new Map(), firstSeen: new Map(), trackingSince: null };
	for (const row of repos.results as { owner: string; name: string; first_seen: string; days: number }[]) {
		stats.days.set(`${row.owner}/${row.name}`, row.days);
		stats.firstSeen.set(`${row.owner}/${row.name}`, row.first_seen);
	}
	stats.trackingSince = (since.results[0] as { since: string | null } | undefined)?.since ?? null;
	return stats;
}
