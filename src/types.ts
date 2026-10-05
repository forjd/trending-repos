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
	topics?: string[];
	homepage?: string | null;
}

export interface Snapshot {
	fetchedAt: string;
	repos: Repo[];
}
