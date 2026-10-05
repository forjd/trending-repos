import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeEntities, enrich, scrapeTrending } from "../src/scrape";
import type { Repo } from "../src/types";
import { apiRepo, mockGitHub, page, row, trendingHtml } from "./helpers";

afterEach(() => vi.restoreAllMocks());

describe("scrapeTrending", () => {
	it("parses GitHub's trending markup", async () => {
		mockGitHub(trendingHtml);
		const repos = await scrapeTrending();
		expect(repos.map((r) => `${r.owner}/${r.name}`)).toEqual([
			"tester-army/e2e",
			"thedotmack/claude-mem",
			"earthtojake/text-to-cad",
			"pingdotgg/t3code",
			"boykopovar/AnyPS5",
		]);
		expect(repos[0]).toMatchObject({
			url: "https://github.com/tester-army/e2e",
			language: "TypeScript",
			stars: 4548,
			starsToday: 1430,
			description: "Next generation e2e testing framework for web and mobile apps.",
		});
		expect(repos[3].description).toBeNull();
		for (const r of repos) expect(r.description ?? "").not.toMatch(/\s{2}|^\s|\s$/);
	});

	it("counts only the first star link in a row", async () => {
		mockGitHub(page(row("/a/b", { stars: "1,234", extra: `<a href="/a/b/stargazers">56</a>` })));
		const [repo] = await scrapeTrending();
		expect(repo.stars).toBe(1234);
	});

	it("decodes entities and collapses whitespace", async () => {
		mockGitHub(page(row("/a/b", { desc: "Fast &amp;\n\t\tsmall &#x1F680; &#99999999;" })));
		const [repo] = await scrapeTrending();
		expect(repo.description).toBe("Fast & small 🚀 &#99999999;");
	});

	it("drops a repo listed twice with different casing", async () => {
		mockGitHub(page(row("/Foo/Bar"), row("/foo/bar"), row("/x/y")));
		const repos = await scrapeTrending();
		expect(repos.map((r) => r.name)).toEqual(["Bar", "y"]);
	});
});

describe("decodeEntities", () => {
	it("leaves out-of-range code points alone instead of throwing", () => {
		expect(decodeEntities("a&#x110000;b&#65;")).toBe("a&#x110000;bA");
	});
});

describe("enrich", () => {
	const repos = (n: number): Repo[] =>
		Array.from({ length: n }, (_, i) => ({
			owner: "o",
			name: `r${i}`,
			url: "",
			description: null,
			language: null,
			languageColor: null,
			stars: 1,
			forks: 1,
			starsToday: 1,
			avatarUrl: "",
		}));

	it("adds API fields including the stable id", async () => {
		mockGitHub("", () => Response.json(apiRepo({ id: 42, stargazers_count: 999 })));
		const [repo] = await enrich(repos(1), undefined);
		expect(repo).toMatchObject({ id: 42, stars: 999, topics: ["cli"] });
	});

	it("stops calling the API once rate limited", async () => {
		const fetch = mockGitHub(
			"",
			() => new Response("rate limited", { status: 403, headers: { "x-ratelimit-remaining": "0" } }),
		);
		const out = await enrich(repos(20), undefined);
		expect(out).toHaveLength(20);
		expect(out.every((r) => r.topics === undefined)).toBe(true);
		// Only the first batch of concurrent lookups goes out
		expect(fetch.mock.calls.length).toBeLessThanOrEqual(6);
	});

	it("keeps a repo as scraped when its lookup fails", async () => {
		mockGitHub("", () => new Response("nope", { status: 500 }));
		const [repo] = await enrich(repos(1), undefined);
		expect(repo.stars).toBe(1);
	});
});
