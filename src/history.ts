import type { Snapshot } from "./types";

// Appends a scrape to D1. The batch runs as one transaction.
export async function saveSnapshot(db: D1Database, snapshot: Snapshot): Promise<void> {
	const insert = db.prepare(
		`INSERT INTO snapshot_repos
			(fetched_at, rank, owner, name, description, language, stars, forks, stars_today, topics, homepage, repo_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
				r.id ?? null,
			),
		),
	);
}

export interface TrendingStats {
	// Distinct UTC days each repo has appeared, keyed by rank in the current scrape
	days: Map<number, number>;
	// First day each repo appeared (YYYY-MM-DD), keyed by rank in the current scrape
	firstSeen: Map<number, string>;
	// First day we have any history for (YYYY-MM-DD)
	trackingSince: string | null;
}

type StatsRow = { rank: number; first_seen: string; days: number };

// History for the repos in the scrape saved at `fetchedAt`. A past row counts as the same
// repo if its GitHub id matches (survives renames) or its owner/name matches ignoring case.
export async function getTrendingStats(db: D1Database, fetchedAt: string): Promise<TrendingStats> {
	const [repos, since] = await db.batch<StatsRow | { since: string | null }>([
		db
			.prepare(
				`SELECT c.rank,
					substr(MIN(h.fetched_at), 1, 10) AS first_seen,
					COUNT(DISTINCT substr(h.fetched_at, 1, 10)) AS days
				FROM snapshot_repos c
				-- A UNION of two lookups, not an OR, so each side uses its index instead of a full scan
				JOIN snapshot_repos h ON h.rowid IN (
					SELECT rowid FROM snapshot_repos WHERE repo_id = c.repo_id
					UNION
					SELECT rowid FROM snapshot_repos WHERE owner = c.owner COLLATE NOCASE AND name = c.name COLLATE NOCASE
				)
				WHERE c.fetched_at = ?
				GROUP BY c.rank`,
			)
			.bind(fetchedAt),
		db.prepare(`SELECT substr(MIN(fetched_at), 1, 10) AS since FROM snapshot_repos`),
	]);

	const stats: TrendingStats = { days: new Map(), firstSeen: new Map(), trackingSince: null };
	for (const row of repos.results as StatsRow[]) {
		stats.days.set(row.rank, row.days);
		stats.firstSeen.set(row.rank, row.first_seen);
	}
	stats.trackingSince = (since.results[0] as { since: string | null } | undefined)?.since ?? null;
	return stats;
}
