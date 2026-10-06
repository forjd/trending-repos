-- One row per repo per UTC day it trended, so badge stats read at most one row per day
-- however often we scrape. snapshot_repos keeps the full per-scrape history.
CREATE TABLE repo_days (
	day      TEXT    NOT NULL,                -- YYYY-MM-DD (UTC)
	owner    TEXT    NOT NULL COLLATE NOCASE,
	name     TEXT    NOT NULL COLLATE NOCASE,
	repo_id  INTEGER,                         -- NULL until an API lookup for that day succeeds
	PRIMARY KEY (owner, name, day)
);

CREATE INDEX idx_repo_days_repo_id ON repo_days (repo_id, day);

INSERT INTO repo_days (day, owner, name, repo_id)
SELECT substr(fetched_at, 1, 10), owner, name, MAX(repo_id)
FROM snapshot_repos
GROUP BY substr(fetched_at, 1, 10), owner COLLATE NOCASE, name COLLATE NOCASE;
