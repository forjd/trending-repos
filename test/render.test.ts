import { describe, expect, it } from "vitest";
import { renderPage, STALE_AFTER_MS, timeAgo } from "../src/render";
import type { Repo } from "../src/types";

const repo = (fields: Partial<Repo> = {}): Repo => ({
	owner: "o",
	name: "r",
	url: "https://github.com/o/r",
	description: null,
	language: null,
	languageColor: null,
	stars: 12345,
	forks: 6,
	starsToday: 10,
	avatarUrl: "https://avatars.githubusercontent.com/u/1",
	...fields,
});

describe("renderPage", () => {
	it("escapes repo text and drops unsafe homepages", () => {
		const html = renderPage({
			fetchedAt: "2026-10-05T00:00:00.000Z",
			repos: [repo({ description: `<script>alert(1)</script>`, homepage: "javascript:alert(1)", topics: [`"><img>`] })],
		});
		expect(html).not.toContain("<script>alert");
		expect(html).not.toContain("javascript:");
		expect(html).not.toContain(`"><img>`);
	});

	it("gives screen readers the exact counts", () => {
		const html = renderPage({ fetchedAt: "2026-10-05T00:00:00.000Z", repos: [repo()] });
		expect(html).toContain(`<span class="sr-only">12,345 stars</span>`);
	});

	it("shows the days-trending badge from 2 days", () => {
		const html = (r: Partial<Repo>) => renderPage({ fetchedAt: "2026-10-05T00:00:00.000Z", repos: [repo(r)] });
		expect(html({ daysTrending: 1 })).not.toContain("Trended on");
		expect(html({ daysTrending: 3 })).toContain("Trended on 3 days");
		expect(html({ isNew: true })).toContain("New today");
	});

	it("warns when the data is stale", () => {
		const fetchedAt = "2026-10-05T00:00:00.000Z";
		const at = (ms: number) => renderPage({ fetchedAt, repos: [repo()] }, new Date(Date.parse(fetchedAt) + ms));
		expect(at(STALE_AFTER_MS - 60_000)).not.toContain(`class="stale"`);
		expect(at(STALE_AFTER_MS + 60_000)).toContain(`class="stale"`);
	});

	it("loads fonts from this site only", () => {
		const html = renderPage(null);
		expect(html).toContain(`url(/fonts/inter-v20-latin.woff2)`);
		expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
	});
});

describe("timeAgo", () => {
	it("formats minutes, hours and days", () => {
		const now = new Date("2026-10-05T12:00:00Z");
		expect(timeAgo("2026-10-05T11:59:50Z", now)).toBe("just now");
		expect(timeAgo("2026-10-05T11:15:00Z", now)).toBe("45 min ago");
		expect(timeAgo("2026-10-05T11:00:00Z", now)).toBe("1 hour ago");
		expect(timeAgo("2026-10-03T12:00:00Z", now)).toBe("2 days ago");
	});
});
