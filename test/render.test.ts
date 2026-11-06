import { describe, expect, it } from "vitest";
import { chartTime, clip, renderPage, SITE_URL, STALE_AFTER_MS, timeAgo } from "../src/render";
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
const githubOrder = (...repos: Repo[]) => renderPage({ fetchedAt: FETCHED_AT, repos }, new Date(), "github");
const count = (html: string, needle: string) => html.split(needle).length - 1;

// WCAG contrast ratio between two #rgb or #rrggbb colours
const contrast = (a: string, b: string) => {
	const luminance = (color: string) => {
		const hex = color.length === 4 ? color.replace(/[0-9a-f]/g, "$&$&") : color;
		const [r, g, bl] = [1, 3, 5].map((i) => {
			const c = parseInt(hex.slice(i, i + 2), 16) / 255;
			return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
	};
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

describe("renderPage", () => {
	it("escapes repo text and drops unsafe homepages", () => {
		const html = page(repo({ description: `<script>alert(1)</script>`, homepage: "javascript:alert(1)", topics: [`"><img>`] }));
		expect(html).not.toContain("<script>alert");
		expect(html).not.toContain("javascript:");
		expect(html).not.toContain(`"><img>`);
	});

	it("escapes a long description in its title and in every cut", () => {
		const hostile = `${"word ".repeat(40)}"><svg onload=alert(1)> <b>&`;
		const html = page(repo({ description: hostile }));
		expect(html).not.toContain("<svg onload");
		expect(html).toContain(`title="${"word ".repeat(40)}&#34;&#62;&#60;svg onload=alert(1)&#62; &#60;b&#62;&#38;"`);
	});

	it("only puts a hex language colour into the inline style", () => {
		expect(page(repo({ language: "TypeScript", languageColor: "#3178c6" }))).toContain(`style="background:#3178c6"`);
		const bad = page(repo({ language: "TypeScript", languageColor: "red;background:url(x)" }));
		expect(bad).not.toContain(`class="swatch"`);
		expect(bad).not.toContain("url(x)");
	});

	it("gives screen readers the exact counts and the owner in the repo link", () => {
		const html = page(repo({ owner: "acme", name: "awesome" }));
		expect(html).toContain(`<span class="sr-only">12,345 stars in total</span>`);
		expect(html).toContain(
			`<a class="name" href="https://github.com/o/r"><span class="who"><span class="owner">acme</span><span class="sep"> / </span></span><span class="repo">awesome</span></a>`,
		);
	});

	it("drops homepages that only lead back to GitHub", () => {
		expect(page(repo({ homepage: "https://github.github.com/spec-kit/" }))).not.toContain(`class="site"`);
		expect(page(repo({ homepage: "https://github.com/o/r" }))).not.toContain(`class="site"`);
		expect(page(repo({ homepage: "https://www.github.com/o/r" }))).not.toContain(`class="site"`);
		expect(page(repo({ homepage: "https://GitHub.com/o/r" }))).not.toContain(`class="site"`);
		expect(page(repo({ homepage: "https://gist.github.com/o/1" }))).not.toContain(`class="site"`);
		// GitHub Pages sites are the project's own pages, so they stay
		expect(page(repo({ homepage: "https://o.github.io/r" }))).toContain(`class="site"`);
		expect(page(repo({ homepage: "https://notgithub.com" }))).toContain(`class="site"`);
	});

	it("shows at most three topics", () => {
		const html = page(repo({ topics: ["t-one", "t-two", "t-three", "t-four", "t-five"] }));
		expect(html).toContain(`<span class="t">t-one</span> <span class="t">t-two</span> <span class="t">t-three</span>`);
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
		// No history at all (D1 failed), so there are no day counts to explain
		expect(none).not.toContain(`class="key-days"`);

		expect(page(repo({ daysTrending: 1 }))).not.toContain("first day on GitHub trending");
		expect(page(repo({ isNew: true, daysTrending: 1 }))).toContain("first day on GitHub trending");
	});

	it("boxes runs of 4 days or more, and prints runs of 7 or more larger", () => {
		// The row's own cell, up to its screen-reader text, so the legend sample can't satisfy the check
		const cell = (days: number) => page(repo({ daysTrending: days })).match(/<span class="on">([\s\S]*?)<\/span>\s*<div class="body">/)?.[1] ?? "";
		expect(cell(3)).toContain(`<span class="plain"><span class="on-n">3</span>`);
		expect(cell(4)).toContain(`<span class="run"><span class="on-n mid">4</span>`);
		expect(cell(6)).toContain(`<span class="run"><span class="on-n mid">6</span>`);
		expect(cell(7)).toContain(`<span class="run"><span class="on-n long">7</span>`);
	});

	it("shows a boxed legend sample that matches the rule it explains", () => {
		const short = page(repo({ daysTrending: 2 }));
		expect(short).toMatch(/class="key-days"[^>]*><span class="run"><span class="on-n mid">4<\/span>[\s\S]*?boxed from 4 days/);
		expect(page(repo({ daysTrending: 9 }))).toMatch(/class="key-days"[^>]*><span class="run"><span class="on-n mid">9<\/span>/);
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

	it("marks only the No. 1 row", () => {
		const html = page(...names(3));
		expect(count(html, `class="row one"`)).toBe(1);
		expect(html).toMatch(/class="row one">\s*<span class="pos">1<\/span>/);
	});

	it("ranks by stars today by default, keeping GitHub's order on a tie", () => {
		const html = page(repo({ name: "a", starsToday: 50 }), repo({ name: "b", starsToday: 200 }), repo({ name: "c", starsToday: 50 }));
		const names = [...html.matchAll(/<span class="repo">(\w+)<\/span>/g)].map((m) => m[1]);
		expect(names).toEqual(["b", "a", "c"]);
		expect(html).toContain(`<a href="/" aria-current="page">Stars today</a>`);
		// No. 1 is the top gain in this order, so no row needs the chip
		expect(html).not.toContain(`class="row one top"`);
		expect(html).not.toContain(`class="row top"`);
	});

	it("keeps GitHub's order on request and marks its top gain once, the higher position on a tie", () => {
		const html = githubOrder(repo({ name: "a", starsToday: 50 }), repo({ name: "b", starsToday: 200 }), repo({ name: "c", starsToday: 10 }));
		const names = [...html.matchAll(/<span class="repo">(\w+)<\/span>/g)].map((m) => m[1]);
		expect(names).toEqual(["a", "b", "c"]);
		expect(html).toContain(`<a href="/?sort=github" aria-current="page">GitHub's order</a>`);
		expect(count(html, `class="row top"`)).toBe(1);
		expect(html).toMatch(/class="row top">[\s\S]*?<span class="repo">b<\/span>/);

		const tie = githubOrder(repo({ name: "a", starsToday: 200 }), repo({ name: "b", starsToday: 200 }));
		expect(count(tie, " top\"")).toBe(1);
		expect(tie).toContain(`class="row one top"`);

		expect(githubOrder(repo({ starsToday: 500 }))).not.toContain(" top\"");
	});

	it("scales each gain bar to the day's biggest gain", () => {
		const html = page(repo({ name: "a", starsToday: 200 }), repo({ name: "b", starsToday: 50 }), repo({ name: "c", starsToday: 1 }));
		const widths = [...html.matchAll(/<span style="width:(\d+)%"><\/span>/g)].map((m) => Number(m[1]));
		// The smallest still shows a sliver
		expect(widths).toEqual([100, 25, 8]);
	});

	it("draws no bar for no gain", () => {
		const widths = (html: string) => [...html.matchAll(/<span style="width:(\d+)%"><\/span>/g)].map((m) => Number(m[1]));
		expect(widths(page(repo({ name: "a", starsToday: 200 }), repo({ name: "b", starsToday: 0 })))).toEqual([100, 0]);
		expect(widths(page(repo({ name: "a", starsToday: 0 }), repo({ name: "b", starsToday: 0 })))).toEqual([0, 0]);
	});

	it("tells screen readers which row has the top gain, and the order the chart is in", () => {
		const stars = page(repo({ name: "a", starsToday: 50 }), repo({ name: "b", starsToday: 200 }));
		expect(count(stars, ", the top gain")).toBe(1);
		expect(stars).toMatch(/\+200<span class="sr-only"> stars today, the top gain<\/span>/);
		expect(stars).toContain(`<span class="key-rank">Ranked by stars today.</span>`);
		const github = githubOrder(repo({ name: "a", starsToday: 50 }), repo({ name: "b", starsToday: 200 }));
		expect(github).toMatch(/\+200<span class="sr-only"> stars today, the top gain<\/span>/);
		expect(github).toContain(`<span class="key-rank">Ranked in GitHub's own trending order, not by stars today.</span>`);
	});

	it("sums the key's totals and counts new repos", () => {
		const html = page(repo({ starsToday: 1000, isNew: true }), repo({ name: "s", starsToday: 234 }));
		expect(html).toContain("<strong>2</strong> repos gained <strong>1,234</strong> stars today, <strong>1</strong> of them new");
		expect(page(repo())).not.toContain("of them new");
		expect(page(repo())).toContain("<strong>1</strong> repo gained");
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

	it("tints the browser chrome with each scheme's yellow", () => {
		const html = renderPage(null);
		const yellows = [...html.matchAll(/--yellow: (#[0-9a-f]{6});/g)].map((m) => m[1]);
		// Light first, then the deeper yellow the dark sheet uses
		expect(yellows).toHaveLength(2);
		expect(yellows[1]).not.toBe(yellows[0]);
		expect(html).toContain(`<meta name="theme-color" content="${yellows[0]}" media="(prefers-color-scheme: light)">`);
		expect(html).toContain(`<meta name="theme-color" content="${yellows[1]}" media="(prefers-color-scheme: dark)">`);
	});

	it("keeps ink on both yellows, and both inks on their sheets, at 7:1 or more", () => {
		const html = renderPage(null);
		const tokens = (css: string) => (name: string) => css.match(new RegExp(`--${name}: (#[0-9a-f]{3}(?:[0-9a-f]{3})?);`))?.[1] ?? "";
		const light = tokens(html.match(/:root \{([^}]+)\}/)?.[1] ?? "");
		const dark = tokens(html.match(/prefers-color-scheme: dark\) \{\s*:root \{([^}]+)\}/)?.[1] ?? "");
		// The masthead prints black on yellow in both schemes
		expect(contrast(light("yellow"), light("black"))).toBeGreaterThanOrEqual(7);
		expect(contrast(dark("yellow"), light("black"))).toBeGreaterThanOrEqual(7);
		// Light --pos is var(--ink), so it falls back to ink
		for (const t of [light, dark]) {
			for (const fg of ["ink", "muted", "desc", "pos"]) expect(contrast(t("sheet"), t(fg) || t("ink"))).toBeGreaterThanOrEqual(7);
		}
		// Gain bars sit on a 12% ink track: they keep 3:1 against it on both sheets.
		// The dark sheet prints them in its yellow; the light sheet needs a deep gold
		const hex6 = (c: string) => (c.length === 4 ? `#${[...c.slice(1)].map((d) => d + d).join("")}` : c);
		const mix = (a: string, b: string, p: number) =>
			`#${[1, 3, 5].map((i) => Math.round(parseInt(hex6(a).slice(i, i + 2), 16) * p + parseInt(hex6(b).slice(i, i + 2), 16) * (1 - p)).toString(16).padStart(2, "0")).join("")}`;
		expect(html).toContain("--bar: var(--yellow);");
		expect(contrast(light("bar"), mix(light("ink"), light("sheet"), 0.12))).toBeGreaterThanOrEqual(3);
		expect(contrast(dark("yellow"), mix(dark("ink"), dark("sheet"), 0.12))).toBeGreaterThanOrEqual(3);
		expect(html).toContain(".bar span { background: var(--bar); }");
		// The NEW tag prints black on pink in both schemes
		expect(html).toMatch(/\.stamp \{[^}]*background: var\(--pink\);\s*color: var\(--black\);/);
		expect(contrast(light("pink"), light("black"))).toBeGreaterThanOrEqual(4.5);
		expect(contrast(dark("pink"), light("black"))).toBeGreaterThanOrEqual(4.5);
		// The No. 1 band is yellow, with black type and a deep gold for its grey text
		const band = html.match(/\.row\.one, \.row\.one:hover \{([^}]+)\}/)?.[1] ?? "";
		expect(band).toContain("--ink: var(--black);");
		// A boxed run and the top-gain chip print --sheet on --ink, so inside the band they must be yellow on black
		expect(band).toContain("--sheet: var(--yellow);");
		expect(band).toContain("background: var(--yellow);");
		for (const name of ["muted", "desc"]) {
			const grey = band.match(new RegExp(`--${name}: (#[0-9a-f]{6});`))?.[1] ?? "";
			expect(grey, `band --${name}`).toMatch(/^#/);
			for (const yellow of [light("yellow"), dark("yellow")]) expect(contrast(yellow, grey)).toBeGreaterThanOrEqual(7);
		}
	});

	it("keeps pink for NEW only", () => {
		const html = renderPage(null);
		// Pink is the second spot colour: the NEW tag is the only rule that uses it
		expect(html.match(/var\(--pink\)/g) ?? []).toHaveLength(1);
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
	});

	it("repeats the page title and description, and describes the image", () => {
		const html = renderPage(null);
		const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
		const description = html.match(/<meta name="description" content="([^"]+)">/)?.[1];
		expect(title).toBeTruthy();
		expect(description).toBeTruthy();
		expect(html).toContain(`<meta property="og:title" content="${title}">`);
		expect(html).toContain(`<meta property="og:description" content="${description}">`);
		// public/og.png is 1200x630; regenerate it with npm run og
		expect(html).toContain(`<meta property="og:image:type" content="image/png">`);
		expect(html).toContain(`<meta property="og:image:width" content="1200">`);
		expect(html).toContain(`<meta property="og:image:height" content="630">`);
		expect(html).toMatch(/<meta property="og:image:alt" content="[^"]+">/);
	});
});

describe("footer", () => {
	it("links to the JSON, the source, the models chart and the author's blog", () => {
		for (const html of [renderPage(null), page(repo())]) {
			const footer = html.match(/<footer>[\s\S]*<\/footer>/)?.[0];
			expect(footer, "page has no <footer>").toBeDefined();
			expect(footer).toContain(
				`<p class="foot-links">` +
					`<a href="/api/trending">JSON</a>` +
					`<a href="https://github.com/forjd/trending-repos">Source</a>` +
					`<a href="https://models.ddewhurst.com/">Trending AI models</a>` +
					`<a href="https://ddewhurst.com" rel="author">ddewhurst.com</a>` +
					`</p>`,
			);
		}
	});

	it("wraps the links, so they fit on a 320px screen", () => {
		expect(renderPage(null)).toMatch(/\.foot-links \{[^}]*flex-wrap: wrap/);
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
		expect(html).toContain(`class="when-ago"`);
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
			`<time datetime="2026-10-05T23:30:00Z">23:30 UTC</time>`,
		);
	});
});

describe("descriptions", () => {
	it("drops a leading emoji and bare URLs", () => {
		const html = page(repo({ description: "🚀 Fast tool. Join us: https://discord.gg/abc and star it" }));
		expect(html).toContain(`<p class="desc">Fast tool. Join us: and star it</p>`);
		expect(html).not.toContain("discord.gg");
	});

	it("takes a URL's brackets with it, leaves no dangling label, and keeps text that only contains a URL", () => {
		const desc = (d: string) => page(repo({ description: d })).match(/<p class="desc">([^<]*)<\/p>/)?.[1];
		expect(desc("Docs and demo (https://example.com) for the thing")).toBe("Docs and demo for the thing");
		expect(desc("A tool. Official site: https://example.com")).toBe("A tool. Official site");
		expect(desc("See https://a.b/c. Then more")).toBe("See. Then more");
		// Glued to a word, so not a bare URL
		expect(desc("Use it via git+https://x.y/z")).toBe("Use it via git+https://x.y/z");
		// Nothing would be left, so the original text stays
		expect(desc("https://example.com")).toBe("https://example.com");
	});

	it("strips leading emoji sequences and shortcodes, but not emoji inside the text", () => {
		const desc = (d: string) => page(repo({ description: d })).match(/<p class="desc">([^<]*)<\/p>/)?.[1];
		expect(desc(":rocket: :zap: Fast")).toBe("Fast");
		expect(desc("👩🏽‍💻 Code")).toBe("Code");
		expect(desc("Ships 🚀 fast")).toBe("Ships 🚀 fast");
		expect(desc("🚀")).toBe("🚀");
	});

	it("prints a short cut for phones and a long one for wider screens, both at a word", () => {
		const text = "word ".repeat(40).trim();
		const html = page(repo({ description: text }));
		expect(html).toContain(`<span class="d-long">${clip(text, 150)}</span><span class="d-mid">${clip(text, 104)}</span><span class="d-short">${clip(text, 76)}</span>`);
		expect(page(repo({ description: "Short." }))).toContain(`>Short.</p>`);
	});

	it("keeps the whole cleaned description in the title when it cuts one", () => {
		const text = "word ".repeat(40).trim();
		expect(page(repo({ description: `🚀 ${text} https://example.com` }))).toContain(`<p class="desc" title="${text}">`);
	});
});

describe("clip", () => {
	it("cuts at a word, without trailing punctuation before the ellipsis", () => {
		expect(clip("alpha beta gamma", 20)).toBe("alpha beta gamma");
		expect(clip("alpha beta gamma", 12)).toBe("alpha beta…");
		expect(clip("in 8 GB of RAM. Portable", 16)).toBe("in 8 GB of RAM…");
	});

	it("counts a CJK character as two and can cut between them", () => {
		expect(clip("用AI构建新闻雷达", 6)).toBe("用AI构…");
	});

	it("keeps Korean words whole, because Korean spaces its words", () => {
		expect(clip("한국어 설명입니다 길게", 12)).toBe("한국어…");
	});

	it("keeps text that fits exactly, and cuts one long word at the width", () => {
		expect(clip("abcde", 5)).toBe("abcde");
		expect(clip("abcdefghij", 5)).toBe("abcde…");
	});

	it("never splits an emoji in half", () => {
		const cut = clip("abcd😀efgh", 5);
		expect(cut).toBe("abcd😀…");
		expect(cut).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
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
