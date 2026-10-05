export interface Repo {
	owner: string;
	name: string;
	url: string;
	description: string | null;
	language: string | null;
	languageColor: string | null;
	stars: number;
	forks: number;
	starsToday: number;
	avatarUrl: string;
	// Filled in from the GitHub API
	id?: number; // stable across renames
	topics?: string[];
	homepage?: string | null;
	// Filled in from D1 history
	daysTrending?: number; // distinct UTC days seen on trending, including today
	isNew?: boolean; // first seen today, and we were tracking before today
}

export interface Snapshot {
	fetchedAt: string;
	repos: Repo[];
}
