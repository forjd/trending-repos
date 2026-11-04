import { createScheduledController, env } from "cloudflare:test";
import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../src/index";
import { etagMatches } from "../src/http";
import { MIN_CRON_INTERVAL_MS, refresh } from "../src/refresh";
import { STALE_AFTER_MS } from "../src/render";
import { pingHealthcheck } from "../src/health";
import type { Snapshot } from "../src/types";
import { apiRepo, fakeId, HEALTHCHECK_URL, mockGitHub, page, row, trendingHtml } from "./helpers";

const worker = exports.default as Fetcher;
const get = (path: string, init?: RequestInit) => worker.fetch(`https://example.com${path}`, init);
// A D1 binding that fails like production did before migration 0003 was applied
const brokenDb = {
	prepare() {
		throw new Error("no such table: repo_days");
	},
} as unknown as D1Database;
const pings = (fetch: ReturnType<typeof mockGitHub>) =>
	fetch.mock.calls.map(([input]) => String(input instanceof Request ? input.url : input)).filter((u) => u.startsWith("https://hc.example"));

beforeEach(async () => {
	await env.DB.exec("DELETE FROM snapshot_repos; DELETE FROM repo_days");
	await env.TRENDING.delete("latest");
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe("routes", () => {
	it("serves the empty state before the first scrape", async () => {
		const res = await get("/");
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("No trending data yet");
		expect(await (await get("/api/trending")).json()).toEqual({ fetchedAt: null, repos: [] });
	});

	it("sends security and cache headers", async () => {
		const res = await get("/");
		expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
		expect(res.headers.get("content-security-policy")).toContain("font-src 'self'");
		// The page loads no remote images
		expect(res.headers.get("content-security-policy")).toContain("img-src data:;");
		expect(await res.text()).not.toContain("fonts.googleapis.com");
		expect(res.headers.get("x-content-type-options")).toBe("nosniff");
		expect(res.headers.get("cache-control")).toBe("public, max-age=60");
		expect((await get("/api/trending")).headers.get("cache-control")).toBe("public, max-age=60");
	});

	it("answers a matching If-None-Match with 304", async () => {
		const etag = (await get("/api/trending")).headers.get("etag")!;
		const res = await get("/api/trending", { headers: { "if-none-match": etag } });
		expect(res.status).toBe(304);
	});

	it("matches the weak ETag that Cloudflare sends after compression", async () => {
		const etag = (await get("/")).headers.get("etag")!;
		expect((await get("/", { headers: { "if-none-match": `W/${etag}` } })).status).toBe(304);
		expect((await get("/", { headers: { "if-none-match": `"other", W/${etag}` } })).status).toBe(304);
		expect((await get("/", { headers: { "if-none-match": `W/"other"` } })).status).toBe(200);
	});

	it("changes the page ETag when the stale notice appears", async () => {
		// "12 hours ago" on both sides of the 12-hour limit
		const fetchedAt = "2026-10-05T00:00:00.000Z";
		await env.TRENDING.put("latest", JSON.stringify({ fetchedAt, repos: [] }));
		const at = (ms: number, init?: RequestInit) => {
			vi.useFakeTimers({ now: Date.parse(fetchedAt) + ms, toFake: ["Date"] });
			return get("/", init);
		};
		const before = await at(STALE_AFTER_MS - 60_000);
		const etag = before.headers.get("etag")!;
		expect(await before.text()).not.toContain(`class="stale"`);
		const after = await at(STALE_AFTER_MS + 60_000, { headers: { "if-none-match": etag } });
		expect(after.status).toBe(200);
		expect(after.headers.get("etag")).not.toBe(etag);
		expect(await after.text()).toContain(`class="stale"`);
	});

	it("ranks by stars today, or by GitHub's order with ?sort=github, each with its own ETag", async () => {
		const repo = (name: string, starsToday: number) => ({ owner: "o", name, url: `https://github.com/o/${name}`, description: null, language: null, languageColor: null, stars: 1, forks: 0, starsToday, avatarUrl: "" });
		await env.TRENDING.put("latest", JSON.stringify({ fetchedAt: new Date().toISOString(), repos: [repo("small", 1), repo("big", 9)] }));
		const order = (html: string) => [...html.matchAll(/<span class="repo">(\w+)<\/span>/g)].map((m) => m[1]);
		const stars = await get("/");
		const github = await get("/?sort=github");
		const [starsHtml, githubHtml] = [await stars.clone().text(), await github.clone().text()];
		expect(order(starsHtml)).toEqual(["big", "small"]);
		expect(order(githubHtml)).toEqual(["small", "big"]);
		// The other order's ETag must not revalidate to 304
		expect((await get("/?sort=github", { headers: { "if-none-match": stars.headers.get("etag")! } })).status).toBe(200);
		expect(await stars.text()).toContain(`<a href="/" aria-current="page">Stars today</a>`);
		expect(await github.text()).toContain(`<a href="/?sort=github" aria-current="page">GitHub's order</a>`);
		expect(github.headers.get("etag")).not.toBe(stars.headers.get("etag"));
		// Anything else is the default order
		expect((await get("/?sort=nope")).headers.get("etag")).toBe(stars.headers.get("etag"));
	});

	it("answers HEAD without a body", async () => {
		const res = await get("/", { method: "HEAD" });
		expect(res.status).toBe(200);
		expect(res.headers.get("etag")).toBeTruthy();
		expect(await res.text()).toBe("");
	});

	it("rejects other methods and unknown paths", async () => {
		expect((await get("/", { method: "POST" })).status).toBe(405);
		expect((await get("/__refresh")).status).toBe(405);
		expect((await get("/nope")).status).toBe(404);
	});

	it("requires the refresh key", async () => {
		const res = await get("/__refresh", { method: "POST", headers: { authorization: "Bearer wrong" } });
		expect(res.status).toBe(401);
	});
});

describe("etagMatches", () => {
	it("ignores W/ and accepts lists and *", () => {
		expect(etagMatches(null, `"a"`)).toBe(false);
		expect(etagMatches(`"a"`, `"a"`)).toBe(true);
		expect(etagMatches(`W/"a"`, `"a"`)).toBe(true);
		expect(etagMatches(`"b" , W/"a"`, `"a"`)).toBe(true);
		expect(etagMatches("*", `"a"`)).toBe(true);
		expect(etagMatches(`"ab"`, `"a"`)).toBe(false);
	});
});

describe("refresh", () => {
	it("scrapes, saves history and publishes to KV", async () => {
		mockGitHub(trendingHtml);
		const res = await get("/__refresh", { method: "POST", headers: { authorization: "Bearer test-key" } });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ repos: 5, history: "ok" });

		const snapshot = await env.TRENDING.get<Snapshot>("latest", "json");
		expect(snapshot?.repos[0].daysTrending).toBe(1);
		const { count } = (await env.DB.prepare("SELECT COUNT(*) AS count FROM snapshot_repos").first<{ count: number }>())!;
		expect(count).toBe(5);
	});

	it("fails and keeps the old data when the scrape looks broken", async () => {
		await env.TRENDING.put("latest", JSON.stringify({ fetchedAt: "2026-01-01T00:00:00.000Z", repos: [] }));
		mockGitHub(page(row("/a/b")));
		const res = await get("/__refresh", { method: "POST", headers: { authorization: "Bearer test-key" } });
		expect(res.status).toBe(502);
		expect((await env.TRENDING.get<Snapshot>("latest", "json"))?.fetchedAt).toBe("2026-01-01T00:00:00.000Z");
	});

	it("fails when no row has a stars-today count", async () => {
		mockGitHub(page(...["a", "b", "c", "d", "e"].map((n) => row(`/o/${n}`, { today: "" }))));
		await expect(refresh(env)).rejects.toThrow(/stars-today/);
	});

	it("reports a history failure from /__refresh", async () => {
		mockGitHub(trendingHtml);
		const req = new Request("https://example.com/__refresh", { method: "POST", headers: { authorization: "Bearer test-key" } });
		const res = await handler.fetch!(req as Request<unknown, IncomingRequestCfProperties>, { ...env, DB: brokenDb });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ repos: 5, history: expect.stringMatching(/^failed: .*no such table/) });
	});

	it("still publishes when D1 fails, and reports the history error", async () => {
		mockGitHub(trendingHtml);
		const { snapshot, historyError } = await refresh({ ...env, DB: brokenDb });
		expect(historyError).toMatch(/no such table/);
		expect(snapshot.repos[0].daysTrending).toBeUndefined();
		expect((await env.TRENDING.get<Snapshot>("latest", "json"))?.fetchedAt).toBe(snapshot.fetchedAt);
	});

	it("doesn't overwrite a newer snapshot", async () => {
		await env.TRENDING.put("latest", JSON.stringify({ fetchedAt: "2999-01-01T00:00:00.000Z", repos: [] }));
		mockGitHub(trendingHtml);
		await refresh(env);
		expect((await env.TRENDING.get<Snapshot>("latest", "json"))?.fetchedAt).toBe("2999-01-01T00:00:00.000Z");
	});
});

describe("scheduled", () => {
	const runCron = (now: number, cronEnv: Env = env) => {
		const fetch = mockGitHub(trendingHtml);
		const run = handler.scheduled!(createScheduledController({ scheduledTime: now, cron: "0 */4 * * *" }), cronEnv);
		return { fetch, run };
	};
	const lastScrapeAgo = (ms: number, repos: object[] = []) =>
		env.TRENDING.put("latest", JSON.stringify({ fetchedAt: new Date(Date.now() - ms).toISOString(), repos }));
	const scrapes = async () =>
		(await env.DB.prepare("SELECT COUNT(DISTINCT fetched_at) AS n FROM snapshot_repos").first<{ n: number }>())!.n;

	it("skips a run soon after the last scrape", async () => {
		await lastScrapeAgo(MIN_CRON_INTERVAL_MS - 60_000);
		await runCron(Date.now()).run;
		expect(await scrapes()).toBe(0);
	});

	it("scrapes when the last scrape is old enough, or there is none", async () => {
		await runCron(Date.now()).run;
		expect(await scrapes()).toBe(1);
		await lastScrapeAgo(4 * MIN_CRON_INTERVAL_MS);
		vi.restoreAllMocks();
		await runCron(Date.now()).run;
		expect(await scrapes()).toBe(2);
	});

	it("pings the health check after a good run and after a skipped one", async () => {
		const ok = runCron(Date.now(), { ...env, HEALTHCHECK_URL });
		await ok.run;
		expect(pings(ok.fetch)).toEqual([HEALTHCHECK_URL]);
		vi.restoreAllMocks();
		const skipped = runCron(Date.now(), { ...env, HEALTHCHECK_URL });
		await skipped.run;
		expect(await scrapes()).toBe(1);
		expect(pings(skipped.fetch)).toEqual([HEALTHCHECK_URL]);
	});

	it("doesn't clear a history failure when it skips a run", async () => {
		// Published recently, but without badge stats because D1 failed
		await lastScrapeAgo(60_000, [{ owner: "o", name: "a" }]);
		const { fetch, run } = runCron(Date.now(), { ...env, HEALTHCHECK_URL });
		await run;
		expect(await scrapes()).toBe(0);
		expect(pings(fetch)).toEqual([`${HEALTHCHECK_URL}/fail`]);
	});

	it("sends no ping without a health check URL", async () => {
		const { fetch, run } = runCron(Date.now());
		await run;
		expect(pings(fetch)).toEqual([]);
	});

	it("doesn't fail a good run when the health check is down", async () => {
		for (const failure of [() => new Response("down", { status: 500 }), () => Promise.reject(new Error("timeout"))]) {
			vi.restoreAllMocks();
			const fetch = mockGitHub(trendingHtml);
			const real = fetch.getMockImplementation()!;
			fetch.mockImplementation(async (input, init) =>
				String(input instanceof Request ? input.url : input).startsWith("https://hc.example") ? failure() : real(input, init),
			);
			await env.TRENDING.delete("latest");
			const run = handler.scheduled!(
				createScheduledController({ scheduledTime: Date.now(), cron: "0 */4 * * *" }),
				{ ...env, HEALTHCHECK_URL },
			);
			await expect(run).resolves.toBeUndefined();
		}
	});

	it("fails the run and pings /fail when history can't be saved", async () => {
		const { fetch, run } = runCron(Date.now(), { ...env, DB: brokenDb, HEALTHCHECK_URL });
		await expect(run).rejects.toThrow(/history failed: .*no such table/);
		expect(pings(fetch)).toEqual([`${HEALTHCHECK_URL}/fail`]);
		// The fresh list is still published
		expect((await env.TRENDING.get<Snapshot>("latest", "json"))?.repos).toHaveLength(5);
	});

	it("pings /fail when the scrape fails", async () => {
		const fetch = mockGitHub(page(row("/a/b")));
		const run = handler.scheduled!(
			createScheduledController({ scheduledTime: Date.now(), cron: "0 */4 * * *" }),
			{ ...env, HEALTHCHECK_URL },
		);
		await expect(run).rejects.toThrow(/expected at least 5/);
		expect(pings(fetch)).toEqual([`${HEALTHCHECK_URL}/fail`]);
	});
});

describe("badges", () => {
	const five = ["a", "b", "c", "d", "e"];
	const scrapeAt = async (iso: string, paths: string[], ids: Record<string, number> = {}) => {
		vi.useFakeTimers({ now: new Date(iso), toFake: ["Date"] });
		vi.restoreAllMocks();
		mockGitHub(page(...paths.map((p) => row(p))), (fullName) =>
			Response.json(apiRepo({ id: ids[fullName.toLowerCase()] ?? fakeId(fullName) })),
		);
		return (await refresh(env)).snapshot;
	};

	it("doesn't mark anything new on the first day of history", async () => {
		const snap = await scrapeAt("2026-10-05T08:00:00Z", five.map((n) => `/o/${n}`));
		expect(snap.repos.some((r) => r.isNew)).toBe(false);
	});

	it("marks repos first seen today as new, and counts distinct days", async () => {
		await scrapeAt("2026-10-05T08:00:00Z", five.map((n) => `/o/${n}`));
		await scrapeAt("2026-10-05T12:00:00Z", five.map((n) => `/o/${n}`));
		const snap = await scrapeAt("2026-10-06T08:00:00Z", ["/o/a", "/o/b", "/o/c", "/o/d", "/o/new"]);
		const byName = Object.fromEntries(snap.repos.map((r) => [r.name, r]));
		expect(byName.a).toMatchObject({ daysTrending: 2, isNew: false });
		expect(byName.new).toMatchObject({ daysTrending: 1, isNew: true });
	});

	it("doesn't mark repos new after a day without scrapes", async () => {
		await scrapeAt("2026-10-05T08:00:00Z", five.map((n) => `/o/${n}`));
		const snap = await scrapeAt("2026-10-07T08:00:00Z", ["/o/a", "/o/b", "/o/c", "/o/d", "/o/new"]);
		expect(snap.repos.some((r) => r.isNew)).toBe(false);
	});

	it("keeps one history row per repo per day however often it scrapes", async () => {
		for (const hour of ["08", "09", "10"]) await scrapeAt(`2026-10-05T${hour}:00:00Z`, five.map((n) => `/o/${n}`));
		const { count } = (await env.DB.prepare("SELECT COUNT(*) AS count FROM repo_days").first<{ count: number }>())!;
		expect(count).toBe(5);
	});

	it("follows a repo through a casing change and a rename", async () => {
		const ids = { "o/a": 7, "o/renamed": 7 };
		await scrapeAt("2026-10-05T08:00:00Z", five.map((n) => `/o/${n}`), ids);
		const snap = await scrapeAt("2026-10-06T08:00:00Z", ["/O/B", "/o/renamed", "/o/c", "/o/d", "/o/e"], ids);
		const byName = Object.fromEntries(snap.repos.map((r) => [r.name, r]));
		expect(byName.B).toMatchObject({ daysTrending: 2, isNew: false });
		expect(byName.renamed).toMatchObject({ daysTrending: 2, isNew: false });
	});
});

describe("pingHealthcheck", () => {
	it("posts the error to <url>/fail, without a doubled slash", async () => {
		const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("OK"));
		await pingHealthcheck(`${HEALTHCHECK_URL}/`, "boom");
		const [url, init] = fetch.mock.calls[0];
		expect(String(url)).toBe(`${HEALTHCHECK_URL}/fail`);
		expect(init).toMatchObject({ method: "POST", body: "boom" });
	});
});
