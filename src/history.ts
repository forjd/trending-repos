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
