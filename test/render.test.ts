import { describe, expect, it } from "vitest";
import { renderPage, timeAgo } from "../src/render";
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
		expect(html({ daysTrending: 1 })).not.toContain("days trending");
		expect(html({ daysTrending: 3 })).toContain("3 days trending");
		expect(html({ isNew: true })).toContain("New today");
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
