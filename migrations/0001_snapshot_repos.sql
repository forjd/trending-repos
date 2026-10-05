-- One row per repo per scrape
CREATE TABLE snapshot_repos (
	fetched_at   TEXT    NOT NULL, -- ISO 8601, shared by every row from one scrape
	rank         INTEGER NOT NULL, -- 1-based position on github.com/trending
	owner        TEXT    NOT NULL,
	name         TEXT    NOT NULL,
	description  TEXT,
	language     TEXT,
	stars        INTEGER NOT NULL,
	forks        INTEGER NOT NULL,
	stars_today  INTEGER NOT NULL,
	topics       TEXT,             -- JSON array, NULL if the API lookup failed
	homepage     TEXT,
	PRIMARY KEY (fetched_at, rank)
);

CREATE INDEX idx_snapshot_repos_repo ON snapshot_repos (owner, name, fetched_at);
