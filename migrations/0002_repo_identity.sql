-- Match repos across renames (GitHub's numeric id) and URL casing (NOCASE indexes).
-- repo_id is NULL for rows saved before this migration or when the API lookup failed.
ALTER TABLE snapshot_repos ADD COLUMN repo_id INTEGER;

CREATE INDEX idx_snapshot_repos_repo_id ON snapshot_repos (repo_id, fetched_at);

DROP INDEX idx_snapshot_repos_repo;
CREATE INDEX idx_snapshot_repos_repo ON snapshot_repos (owner COLLATE NOCASE, name COLLATE NOCASE, fetched_at);

-- A repo appears at most once per scrape
CREATE UNIQUE INDEX idx_snapshot_repos_unique ON snapshot_repos (fetched_at, owner COLLATE NOCASE, name COLLATE NOCASE);
