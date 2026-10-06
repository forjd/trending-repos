import { createScheduledController, env } from "cloudflare:test";
import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler, { MIN_CRON_INTERVAL_MS, refresh } from "../src/index";
import type { Snapshot } from "../src/types";
import { apiRepo, fakeId, mockGitHub, page, row, trendingHtml } from "./helpers";

const worker = exports.default as Fetcher;
const get = (path: string, init?: RequestInit) => worker.fetch(`https://example.com${path}`, init);

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
		expect(res.headers.get("x-content-type-options")).toBe("nosniff");
		expect(res.headers.get("cache-control")).toBe("public, max-age=60");
		expect((await get("/api/trending")).headers.get("cache-control")).toBe("public, max-age=60");
	});

	it("answers a matching If-None-Match with 304", async () => {
		const etag = (await get("/api/trending")).headers.get("etag")!;
		const res = await get("/api/trending", { headers: { "if-none-match": etag } });
		expect(res.status).toBe(304);
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

describe("refresh", () => {
	it("scrapes, saves history and publishes to KV", async () => {
		mockGitHub(trendingHtml);
		const res = await get("/__refresh", { method: "POST", headers: { authorization: "Bearer test-key" } });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ repos: 5 });

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

	it("doesn't overwrite a newer snapshot", async () => {
		await env.TRENDING.put("latest", JSON.stringify({ fetchedAt: "2999-01-01T00:00:00.000Z", repos: [] }));
		mockGitHub(trendingHtml);
		await refresh(env);
		expect((await env.TRENDING.get<Snapshot>("latest", "json"))?.fetchedAt).toBe("2999-01-01T00:00:00.000Z");
	});
});

describe("scheduled", () => {
	const runCron = (now: number) => {
		mockGitHub(trendingHtml);
		return handler.scheduled!(createScheduledController({ scheduledTime: now, cron: "0 */4 * * *" }), env);
	};
	const lastScrapeAgo = (ms: number) =>
		env.TRENDING.put("latest", JSON.stringify({ fetchedAt: new Date(Date.now() - ms).toISOString(), repos: [] }));
	const scrapes = async () =>
		(await env.DB.prepare("SELECT COUNT(DISTINCT fetched_at) AS n FROM snapshot_repos").first<{ n: number }>())!.n;

	it("skips a run soon after the last scrape", async () => {
		await lastScrapeAgo(MIN_CRON_INTERVAL_MS - 60_000);
		await runCron(Date.now());
		expect(await scrapes()).toBe(0);
	});

	it("scrapes when the last scrape is old enough, or there is none", async () => {
		await runCron(Date.now());
		expect(await scrapes()).toBe(1);
		await lastScrapeAgo(4 * MIN_CRON_INTERVAL_MS);
		await runCron(Date.now());
		expect(await scrapes()).toBe(2);
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
		return refresh(env);
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
