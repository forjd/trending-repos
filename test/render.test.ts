import { describe, expect, it } from "vitest";
import { chartTime, renderPage, SITE_URL, STALE_AFTER_MS, timeAgo } from "../src/render";
import type { Repo } from "../src/types";

const FETCHED_AT = "2026-10-05T00:00:00.000Z";

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

const page = (...repos: Repo[]) => renderPage({ fetchedAt: FETCHED_AT, repos });
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("renderPage", () => {
	it("escapes repo text and drops unsafe homepages", () => {
		const html = page(repo({ description: `<script>alert(1)</script>`, homepage: "javascript:alert(1)", topics: [`"><img>`] }));
		expect(html).not.toContain("<script>alert");
		expect(html).not.toContain("javascript:");
		expect(html).not.toContain(`"><img>`);
	});

	it("only puts a hex language colour into the inline style", () => {
		expect(page(repo({ language: "TypeScript", languageColor: "#3178c6" }))).toContain(`style="background:#3178c6"`);
		const bad = page(repo({ language: "TypeScript", languageColor: "red;background:url(x)" }));
		expect(bad).not.toContain(`class="swatch"`);
		expect(bad).not.toContain("url(x)");
	});

	it("gives screen readers the exact counts and the owner in the repo link", () => {
		const html = page(repo({ owner: "acme", name: "awesome" }));
		expect(html).toContain(`<span class="sr-only">12,345 stars</span>`);
		expect(html).toContain(`<a class="name" href="https://github.com/o/r"><span class="sr-only">acme / </span>awesome</a>`);
	});

	it("shows at most three topics", () => {
		const html = page(repo({ topics: ["t-one", "t-two", "t-three", "t-four", "t-five"] }));
		expect(html).toContain("t-one · t-two · t-three");
		expect(html).not.toContain("t-four");
	});
});

describe("days on", () => {
	it("counts days, with the right plural", () => {
		const one = page(repo({ daysTrending: 1 }));
		expect(one).toContain(`<span class="on-l">day</span>`);
		expect(one).toContain("Trended on 1 day");
		const three = page(repo({ daysTrending: 3 }));
		expect(three).toContain(`<span class="on-l">days</span>`);
		expect(three).toContain("Trended on 3 days");
	});

	it("sets runs of 7 days or more heavier", () => {
		expect(page(repo({ daysTrending: 6 }))).not.toContain("on-n long");
		expect(page(repo({ daysTrending: 7 }))).toContain(`class="on-n long"`);
	});

	it("stamps new repos instead of counting their days", () => {
		const html = page(repo({ isNew: true, daysTrending: 4 }));
		expect(html).toContain(`class="stamp"`);
		expect(html).toContain("New today");
		expect(html).not.toContain("Trended on 4 days");
	});

	it("caps the stamp delay so late rows don't wait long", () => {
		const repos = Array.from({ length: 30 }, (_, i) => repo({ name: `r${i}`, isNew: i === 29 }));
		expect(page(...repos)).toContain("animation-delay:1000ms");
	});

	it("shows a dash without history, and only explains NEW when a repo is new", () => {
		const none = page(repo(), repo({ name: "s" }));
		expect(count(none, "No history yet")).toBe(2);
		expect(none).not.toContain(`class="stamp stamp-key"`);
		expect(none).toContain("Days on:");

		expect(page(repo({ daysTrending: 1 }))).not.toContain("first seen on trending today");
		expect(page(repo({ isNew: true, daysTrending: 1 }))).toContain("first seen on trending today");
	});
});

describe("chart layout", () => {
	const names = (n: number) => Array.from({ length: n }, (_, i) => repo({ name: `r${i + 1}`, starsToday: 10 }));

	it("splits the chart into two numbered columns", () => {
		const html = page(...names(5));
		expect(html).toContain(`aria-label="Positions 1 to 3"`);
		expect(html).toContain(`aria-label="Positions 4 to 5"`);
		expect(html).toContain(`start="1"`);
		expect(html).toContain(`start="4"`);
		const positions = [...html.matchAll(/<span class="pos">(\d+)<\/span>/g)].map((m) => Number(m[1]));
		expect(positions).toEqual([1, 2, 3, 4, 5]);
	});

	it("prints one column for one repo and one row each for two", () => {
		const one = page(...names(1));
		expect(count(one, `<section class="col"`)).toBe(1);
		expect(one).toContain(`aria-label="Positions 1 to 1"`);
		const two = page(...names(2));
		expect(count(two, `<section class="col"`)).toBe(2);
		expect(two).toContain(`aria-label="Positions 2 to 2"`);
	});

	it("reverses only the No. 1 row", () => {
		const html = page(...names(3));
		expect(count(html, `class="row one"`)).toBe(1);
		expect(html).toMatch(/class="row one">\s*<span class="pos">1<\/span>/);
	});

	it("labels the top gain once, and the higher position on a tie", () => {
		const html = page(repo({ name: "a", starsToday: 50 }), repo({ name: "b", starsToday: 200 }), repo({ name: "c", starsToday: 10 }));
		expect(count(html, "top gain today")).toBe(1);
		expect(html).toMatch(/\+200<\/span>\s*<span class="gain-l top">top gain today/);

		const tie = page(repo({ name: "a", starsToday: 200 }), repo({ name: "b", starsToday: 200 }));
		expect(count(tie, "top gain today")).toBe(1);
		expect(tie).toMatch(/<span class="pos">1<\/span>[\s\S]*top gain today[\s\S]*<span class="pos">2<\/span>/);

		expect(page(repo({ starsToday: 500 }))).not.toContain("top gain today");
	});

	it("sums the key's totals and counts new repos", () => {
		const html = page(repo({ starsToday: 1000, isNew: true }), repo({ name: "s", starsToday: 234 }));
		expect(html).toContain("<strong>2</strong> repos gained <strong>1,234</strong> stars today, <strong>1</strong> of them new");
		expect(page(repo())).not.toContain("of them new");
	});
});

describe("freshness and fonts", () => {
	it("warns when the data is stale", () => {
		const at = (ms: number) => renderPage({ fetchedAt: FETCHED_AT, repos: [repo()] }, new Date(Date.parse(FETCHED_AT) + ms));
		expect(at(STALE_AFTER_MS - 60_000)).not.toContain(`class="stale"`);
		expect(at(STALE_AFTER_MS + 60_000)).toContain(`class="stale"`);
	});

	it("loads fonts from this site only", () => {
		const html = renderPage(null);
		expect(html).toContain("url(/fonts/archivo-v25-latin.woff2)");
		expect(html).toContain("url(/fonts/big-shoulders-display-v24-latin.woff2)");
		expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
	});
});

describe("link previews", () => {
	it("gives sharing sites absolute URLs on the custom domain", () => {
		const html = renderPage(null);
		expect(SITE_URL).toBe("https://trending.ddewhurst.com");
		expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/">`);
		expect(html).toContain(`<meta property="og:url" content="${SITE_URL}/">`);
		expect(html).toContain(`<meta property="og:image" content="${SITE_URL}/og.png">`);
		expect(html).toContain(`<meta name="twitter:card" content="summary_large_image">`);
		expect(html).toMatch(/<meta property="og:title" content="[^"]+">/);
		expect(html).toMatch(/<meta property="og:description" content="[^"]+">/);
	});
});

describe("empty and partial states", () => {
	it("shows the empty message and no key or time without a snapshot", () => {
		const html = renderPage(null);
		expect(html).toContain("No trending data yet");
		expect(html).not.toContain(`class="key"`);
		expect(html).not.toContain("<time");
	});

	it("shows the chart time but no key for a snapshot with no repos", () => {
		const html = renderPage({ fetchedAt: FETCHED_AT, repos: [] });
		expect(html).toContain("No trending data yet");
		expect(html).toContain(`class="when-time"`);
		expect(html).not.toContain(`class="key"`);
	});

	it("still renders when the timestamp doesn't parse", () => {
		const html = renderPage({ fetchedAt: "not a date", repos: [repo()] });
		expect(html).toContain(`class="row one"`);
		expect(html).not.toContain("<time");
	});
});

describe("chartTime", () => {
	it("formats the UTC date and a 24-hour time", () => {
		expect(chartTime("2026-10-05T23:30:00Z")).toEqual({ day: "Mon 5 Oct 2026", time: "23:30" });
		expect(chartTime("2026-10-06T00:05:00Z")).toEqual({ day: "Tue 6 Oct 2026", time: "00:05" });
		expect(chartTime("2026-09-05T12:00:00Z")?.day).toBe("Sat 5 Sep 2026");
		expect(chartTime("nope")).toBeNull();
	});

	it("puts the raw timestamp on the time element", () => {
		expect(renderPage({ fetchedAt: "2026-10-05T23:30:00Z", repos: [repo()] })).toContain(
			`<time class="when-time" datetime="2026-10-05T23:30:00Z">23:30</time>`,
		);
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
