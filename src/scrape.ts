import type { Repo } from "./types";

const TRENDING_URL = "https://github.com/trending";
const USER_AGENT = "trending-repos (Cloudflare Worker)";

// Parses github.com/trending with HTMLRewriter.
export async function scrapeTrending(): Promise<Repo[]> {
	const res = await fetch(TRENDING_URL, {
		headers: { "user-agent": USER_AGENT, accept: "text/html" },
	});
	if (!res.ok) throw new Error(`GitHub trending returned ${res.status}`);

	const rows: Record<Field, string>[] = [];
	const current = () => rows[rows.length - 1];
	// Collects an element's text, which HTMLRewriter delivers in chunks
	const collect = (field: Field) => ({
		text(chunk: Text) {
			if (current()) current()[field] += chunk.text;
		},
	});

	await new HTMLRewriter()
		.on("article.Box-row", {
			element() {
				rows.push({ path: "", description: "", language: "", languageColor: "", stars: "", forks: "", starsToday: "" });
			},
		})
		.on("article.Box-row h2 a", {
			element(el) {
				current().path = el.getAttribute("href") ?? "";
			},
		})
		.on("article.Box-row > p", collect("description"))
		.on('article.Box-row [itemprop="programmingLanguage"]', collect("language"))
		.on("article.Box-row .repo-language-color", {
			element(el) {
				current().languageColor = el.getAttribute("style")?.match(/#[\da-f]{3,8}\b/i)?.[0] ?? "";
			},
		})
		.on('article.Box-row a[href$="/stargazers"]', collect("stars"))
		.on('article.Box-row a[href$="/forks"]', collect("forks"))
		.on("article.Box-row span.float-sm-right", collect("starsToday"))
		.transform(res)
		.arrayBuffer();

	return rows.flatMap((row): Repo[] => {
		const [owner, name] = row.path.split("/").filter(Boolean);
		if (!owner || !name) return [];
		return [
			{
				owner,
				name,
				url: `https://github.com/${owner}/${name}`,
				description: decodeEntities(row.description.trim()) || null,
				language: row.language.trim() || null,
				languageColor: row.languageColor || null,
				stars: toNumber(row.stars),
				forks: toNumber(row.forks),
				starsToday: toNumber(row.starsToday),
				avatarUrl: `https://github.com/${owner}.png`,
			},
		];
	});
}

type Field = "path" | "description" | "language" | "languageColor" | "stars" | "forks" | "starsToday";

// Adds topics, homepage and exact counts from the GitHub REST API.
// A failed lookup leaves that repo as scraped rather than dropping it.
export async function enrich(repos: Repo[], token: string): Promise<Repo[]> {
	const headers: Record<string, string> = {
		"user-agent": USER_AGENT,
		accept: "application/vnd.github+json",
		"x-github-api-version": "2022-11-28",
	};
	if (token) headers.authorization = `Bearer ${token}`;

	return Promise.all(
		repos.map(async (repo) => {
			try {
				const res = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}`, { headers });
				if (!res.ok) {
					console.warn(`enrich ${repo.owner}/${repo.name}: ${res.status}`);
					return repo;
				}
				const data = await res.json<GitHubRepo>();
				return {
					...repo,
					stars: data.stargazers_count,
					forks: data.forks_count,
					topics: data.topics ?? [],
					homepage: data.homepage || null,
					avatarUrl: data.owner.avatar_url,
				};
			} catch (err) {
				console.warn(`enrich ${repo.owner}/${repo.name}:`, err);
				return repo;
			}
		}),
	);
}

interface GitHubRepo {
	stargazers_count: number;
	forks_count: number;
	topics?: string[];
	homepage: string | null;
	owner: { avatar_url: string };
}

function toNumber(text: string): number {
	return Number(text.replace(/[^\d]/g, "")) || 0;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

// HTMLRewriter text chunks are raw HTML, so entities need decoding
function decodeEntities(text: string): string {
	return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (match, code: string) => {
		if (code[0] === "#") {
			const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
			return Number.isNaN(n) ? match : String.fromCodePoint(n);
		}
		return ENTITIES[code.toLowerCase()] ?? match;
	});
}
