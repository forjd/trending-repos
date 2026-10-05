import type { Repo } from "./types";

const TRENDING_URL = "https://github.com/trending";
const USER_AGENT = "trending-repos (Cloudflare Worker)";
// A hung GitHub request would otherwise stall the whole refresh
const TIMEOUT_MS = 10_000;
// Workers allows 6 open connections at once; more just queue
const CONCURRENCY = 6;

// Parses github.com/trending with HTMLRewriter.
export async function scrapeTrending(): Promise<Repo[]> {
	const res = await fetch(TRENDING_URL, {
		headers: { "user-agent": USER_AGENT, accept: "text/html" },
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	if (!res.ok) throw new Error(`GitHub trending returned ${res.status}`);

	const rows: Row[] = [];
	const current = (): Row | undefined => rows[rows.length - 1];
	// Collects an element's text, which HTMLRewriter delivers in chunks.
	// Only the first match per row counts, so two star links can't merge into one number.
	const collect = (field: Field) => {
		let active = false;
		return {
			element() {
				const row = current();
				active = !!row && !row.seen.has(field);
				row?.seen.add(field);
			},
			text(chunk: Text) {
				if (active) current()![field] += chunk.text;
			},
		};
	};

	await new HTMLRewriter()
		.on("article.Box-row", {
			element() {
				rows.push({ path: "", description: "", language: "", languageColor: "", stars: "", forks: "", starsToday: "", seen: new Set() });
			},
		})
		.on("article.Box-row h2 a", {
			element(el) {
				const row = current();
				if (row && !row.path) row.path = el.getAttribute("href") ?? "";
			},
		})
		.on("article.Box-row > p", collect("description"))
		.on('article.Box-row [itemprop="programmingLanguage"]', collect("language"))
		.on("article.Box-row .repo-language-color", {
			element(el) {
				const row = current();
				if (row) row.languageColor = el.getAttribute("style")?.match(/#[\da-f]{3,8}\b/i)?.[0] ?? "";
			},
		})
		.on('article.Box-row a[href$="/stargazers"]', collect("stars"))
		.on('article.Box-row a[href$="/forks"]', collect("forks"))
		.on("article.Box-row span.float-sm-right", collect("starsToday"))
		.transform(res)
		.arrayBuffer();

	const seen = new Set<string>();
	return rows.flatMap((row): Repo[] => {
		const [owner, name] = row.path.split("/").filter(Boolean);
		if (!owner || !name) return [];
		// GitHub paths are case-insensitive; keep the first of any duplicate
		const key = `${owner}/${name}`.toLowerCase();
		if (seen.has(key)) return [];
		seen.add(key);
		return [
			{
				owner,
				name,
				url: `https://github.com/${owner}/${name}`,
				description: cleanText(row.description) || null,
				language: cleanText(row.language) || null,
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
type Row = Record<Field, string> & { seen: Set<Field> };

// Adds topics, homepage, exact counts and the stable repo id from the GitHub REST API.
// A failed lookup leaves that repo as scraped rather than dropping it.
// Once the API says we're rate limited, the remaining lookups are skipped.
export async function enrich(repos: Repo[], token: string | undefined): Promise<Repo[]> {
	const headers: Record<string, string> = {
		"user-agent": USER_AGENT,
		accept: "application/vnd.github+json",
		"x-github-api-version": "2022-11-28",
	};
	if (token) headers.authorization = `Bearer ${token}`;

	const out = [...repos];
	let next = 0;
	let rateLimited = false;
	let skipped = 0;

	async function lookup(repo: Repo): Promise<Repo> {
		const label = `${repo.owner}/${repo.name}`;
		try {
			const res = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}`, {
				headers,
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
			if (!res.ok) {
				if (res.status === 429 || (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0")) {
					rateLimited = true;
				}
				console.warn(`enrich ${label}: ${res.status}`);
				return repo;
			}
			if (res.headers.get("x-ratelimit-remaining") === "0") rateLimited = true;
			const data = await res.json<GitHubRepo>();
			return {
				...repo,
				id: data.id,
				stars: data.stargazers_count,
				forks: data.forks_count,
				topics: data.topics ?? [],
				homepage: data.homepage || null,
				avatarUrl: data.owner.avatar_url,
			};
		} catch (err) {
			console.warn(`enrich ${label}:`, err);
			return repo;
		}
	}

	async function worker(): Promise<void> {
		while (next < out.length) {
			const i = next++;
			if (rateLimited) {
				skipped++;
				continue;
			}
			out[i] = await lookup(out[i]);
		}
	}

	await Promise.all(Array.from({ length: Math.min(CONCURRENCY, out.length) }, worker));
	if (skipped) console.warn(`enrich: rate limited, skipped ${skipped} lookups`);
	return out;
}

interface GitHubRepo {
	id: number;
	stargazers_count: number;
	forks_count: number;
	topics?: string[];
	homepage: string | null;
	owner: { avatar_url: string };
}

function toNumber(text: string): number {
	return Number(text.replace(/[^\d]/g, "")) || 0;
}

// Decodes entities and collapses the indentation GitHub puts around text
function cleanText(text: string): string {
	return decodeEntities(text).replace(/\s+/g, " ").trim();
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

// HTMLRewriter text chunks are raw HTML, so entities need decoding
export function decodeEntities(text: string): string {
	return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (match, code: string) => {
		if (code[0] === "#") {
			const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
			// fromCodePoint throws above 0x10FFFF, which would fail the whole scrape
			return Number.isNaN(n) || n > 0x10ffff ? match : String.fromCodePoint(n);
		}
		return ENTITIES[code.toLowerCase()] ?? match;
	});
}
