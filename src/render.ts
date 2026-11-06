import type { Repo, Snapshot } from "./types";

// The cron runs every 4 hours, so this is three missed runs in a row
export const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

export function isStale(fetchedAt: string, now: Date): boolean {
	return now.getTime() - Date.parse(fetchedAt) > STALE_AFTER_MS;
}

// Link previews need absolute URLs. The workers.dev address points here too
export const SITE_URL = "https://trending.ddewhurst.com";
// Part of the page's ETag: bump it when the markup changes, so browsers don't revalidate an old page to 304
export const RENDER_VERSION = "4";
const TITLE = "Trending Repos: GitHub trending, with memory";
const DESCRIPTION =
	"The repositories gaining the most stars on GitHub today, charted every four hours with how many days each has trended.";
// public/og.png, made from scripts/og-image.html
const OG_IMAGE_ALT = "Trending Repos, printed as a yellow, pink and black singles chart with positions, days on and stars today.";

// History in D1 starts here, so "days on" can't count further back
const HISTORY_START = "5\u00a0Oct\u00a02026";
// "Days on" grows with a run, so staying power reads at a glance: a run this long prints boxed in ink,
// and a long run prints larger in its box
const MID_RUN = 4;
const LONG_RUN = 7;

// "stars" (the default) ranks by stars today, stable so ties keep GitHub's order; "github" keeps github.com/trending's own order
export type ChartOrder = "github" | "stars";

export function renderPage(snapshot: Snapshot | null, now = new Date(), order: ChartOrder = "stars"): string {
	const byStars = order === "stars";
	const repos = byStars ? [...(snapshot?.repos ?? [])].sort((a, b) => b.starsToday - a.starsToday) : (snapshot?.repos ?? []);
	const totalToday = repos.reduce((sum, r) => sum + r.starsToday, 0);
	const newCount = repos.filter((r) => r.isNew).length;
	// Only worth calling out when there is something to beat; on a tie the higher position wins
	const topGainAt =
		repos.length > 1 ? repos.reduce((best, r, i) => (r.starsToday > repos[best].starsToday ? i : best), 0) : -1;
	// Gain bars scale to the day's biggest gain, so unsorted gains still compare at a glance
	const maxGain = Math.max(0, ...repos.map((r) => r.starsToday));
	// The legend's "days" sample is boxed, so it shows a run of at least MID_RUN days, the longest today if longer.
	// Without any history (D1 failed) the rows show "–", so the sample is left out
	const hasHistory = repos.some((r) => r.daysTrending !== undefined);
	const keyDays = Math.max(MID_RUN, ...repos.map((r) => r.daysTrending ?? 0));

	// Two printed columns on wide screens; one list order for everything else
	const half = Math.ceil(repos.length / 2);
	const columns = [repos.slice(0, half), repos.slice(half)].filter((c) => c.length);

	const chart = repos.length
		? `<div class="chart" style="--rows:${half}">${columns
				.map(
					(col, c) => `
		<section class="col"${c ? ` aria-label="Positions ${half + 1} to ${repos.length}"` : ` aria-label="Positions 1 to ${col.length}"`}>
			<div class="heads" aria-hidden="true"><span>Rank</span><span><span class="h-d1">Days</span> <span class="h-d2">on</span></span><span>Repository <span class="range">${c * half + 1}–${c * half + col.length}</span></span><span>Stars today</span></div>
			<ol class="rows" role="list" start="${c * half + 1}">${col.map((r, i) => renderRow(r, c * half + i + 1, c * half + i === topGainAt, maxGain, byStars)).join("")}</ol>
		</section>`,
				)
				.join("")}
	</div>`
		: `<div class="empty"><p class="empty-title">No trending data yet.</p><p>The first chart is compiled on the next 4-hour run.</p></div>`;

	const when = snapshot ? chartTime(snapshot.fetchedAt) : null;
	const stale =
		snapshot && isStale(snapshot.fetchedAt, now)
			? `<p class="stale" role="status">This chart is from ${timeAgo(snapshot.fetchedAt, now)}. Updates seem to have stopped, so it may be out of date.</p>`
			: "";

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${TITLE}</title>
<meta name="description" content="${DESCRIPTION}">
<link rel="canonical" href="${SITE_URL}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Trending Repos">
<meta property="og:url" content="${SITE_URL}/">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESCRIPTION}">
<meta property="og:image" content="${SITE_URL}/og.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${OG_IMAGE_ALT}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#ffde17" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#e7c537" media="(prefers-color-scheme: dark)">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(FAVICON)}">
<link rel="preload" href="/fonts/big-shoulders-display-v24-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/archivo-v25-latin.woff2" as="font" type="font/woff2" crossorigin>
<style>${CSS}</style>
</head>
<body>
<header class="mast">
	<div class="mast-in">
		<h1>Trending Repos</h1>
		<div class="tag">
			<p class="tag-line">GitHub trending, with memory</p>
			<p>The repositories gaining the most stars on GitHub today, charted every four hours, with how many days each has trended.</p>
		</div>
		${
			when && snapshot
				? `<p class="when">
			<span class="when-label">Updated</span>
			<span class="when-ago">${timeAgo(snapshot.fetchedAt, now)}</span>
			<span class="when-day">Chart of ${when.day}, <time datetime="${esc(snapshot.fetchedAt)}">${when.time} UTC</time></span>
		</p>`
				: ""
		}
	</div>
</header>
${stale}
${
	repos.length
		? `<div class="key">
	<div class="key-top">
		<p class="key-sum"><strong>${repos.length}</strong> ${repos.length === 1 ? "repo" : "repos"} gained <strong>${formatFull(totalToday)}</strong> stars today${newCount ? `, <strong>${newCount}</strong> of them new to trending` : ""}. <span class="key-rank">${byStars ? "Ranked by stars today." : "Ranked in GitHub's own trending order, not by stars today."}</span></p>
		<nav class="sort" aria-label="Chart order"><span class="sort-l">Rank by</span><a href="/"${byStars ? ` aria-current="page"` : ""}>Stars today</a><a href="/?sort=github"${byStars ? "" : ` aria-current="page"`}>GitHub's order</a></nav>
	</div>
	<div class="key-legend">
		${newCount ? `<p class="key-sample"><span class="stamp stamp-key" aria-hidden="true">New</span> = first day on GitHub trending</p>` : ""}
		${hasHistory ? `<p class="key-sample key-days-item"><span class="key-days" aria-hidden="true"><span class="run"><span class="on-n mid">${keyDays}</span><span class="on-l">days</span></span></span> = days on GitHub trending since ${HISTORY_START}; boxed from ${MID_RUN} days</p>` : ""}
		${topGainAt >= 0 ? `<p class="key-sample key-bars"><span class="key-bar" aria-hidden="true"><span></span></span> = share of the day's top gain</p>` : ""}
	</div>
</div>`
		: ""
}
<main>
	${chart}
</main>
<footer>
	<p>Data from <a href="https://github.com/trending">github.com/trending</a> and the GitHub API. Not affiliated with GitHub.</p>
	<p class="foot-links"><a href="/api/trending">JSON</a><a href="https://github.com/forjd/trending-repos">Source</a><a href="https://models.ddewhurst.com/">Trending AI models</a><a href="https://ddewhurst.com" rel="author">ddewhurst.com</a></p>
</footer>
</body>
</html>`;
}

// In stars order No. 1 is the top gain already, so the reversed chip only marks it in GitHub's order
function renderRow(repo: Repo, position: number, isTopGain: boolean, maxGain: number, byStars: boolean): string {
	const topics = (repo.topics ?? []).slice(0, 3);
	const description = repo.description ? cleanDescription(repo.description) : "";
	// Cut on the server at a word, so the two-line clamp rarely has to cut mid-word: a short cut for phones,
	// a longer one for wider screens. Only one prints at a time
	const cuts = { long: clip(description, 150), mid: clip(description, 104), short: clip(description, 76) };
	const homepage = repo.homepage && /^https?:\/\//i.test(repo.homepage) && !pointsBackToGitHub(repo.homepage) ? repo.homepage : null;
	const langColor = repo.languageColor && /^#[\da-f]{3,8}$/i.test(repo.languageColor) ? repo.languageColor : null;
	const delay = Math.min(position, 25) * 40;
	// The smallest gain still shows a sliver; no gain shows no bar
	const bar = maxGain > 0 && repo.starsToday > 0 ? Math.max(8, Math.round((repo.starsToday / maxGain) * 100)) : 0;

	return `
		<li class="row${position === 1 ? " one" : ""}${isTopGain && !byStars ? " top" : ""}">
			<span class="pos">${position}</span>
			<span class="on">${renderDaysOn(repo, delay)}</span>
			<div class="body">
				<a class="name" href="${esc(repo.url)}"><span class="who"><span class="owner">${esc(repo.owner)}</span><span class="sep"> / </span></span><span class="repo">${esc(repo.name)}</span></a>
				<p class="by">
					${repo.language ? `<span class="lang">${langColor ? `<span class="swatch" style="background:${langColor}"></span>` : ""}${esc(repo.language)}</span>` : ""}
					<span class="total" title="${formatFull(repo.stars)} stars in total">${STAR}<span aria-hidden="true">${formatCompact(repo.stars)} total</span><span class="sr-only">${formatFull(repo.stars)} stars in total</span></span>
					<span class="forks" title="${formatFull(repo.forks)} forks"><span aria-hidden="true">${formatCompact(repo.forks)} forks</span><span class="sr-only">${formatFull(repo.forks)} forks</span></span>
					${homepage ? `<span class="site-slot"><a class="site" href="${esc(homepage)}" rel="nofollow ugc noopener">${esc(hostname(homepage))}${ARROW}</a></span>` : ""}
				</p>
				${renderDescription(description, cuts)}
				${topics.length ? `<p class="topics"><span class="sr-only">Topics: </span>${topics.map((t) => `<span class="t">${esc(t)}</span>`).join(" ")}</p>` : ""}
			</div>
			<p class="gain">
				<span class="gain-n">+${formatFull(repo.starsToday)}<span class="sr-only"> stars today${isTopGain ? ", the top gain" : ""}</span></span>
				<span class="bar" aria-hidden="true"><span style="width:${bar}%"></span></span>
			</p>
		</li>`;
}

// GitHub's own mark for a star count, so the total never reads as today's gain
const STAR = `<svg class="star" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M8 .9l2.2 4.6 5 .7-3.6 3.5.9 5L8 12.3l-4.5 2.4.9-5L.8 6.2l5-.7z" fill="currentColor"/></svg>`;

// A homepage on github.com or one of its subdomains only leads back to GitHub, so it adds nothing.
// GitHub Pages sites live on *.github.io and stay
function pointsBackToGitHub(url: string): boolean {
	try {
		const host = new URL(url).hostname.toLowerCase();
		return host === "github.com" || host === "www.github.com" || host.endsWith(".github.com");
	} catch {
		return false;
	}
}

// Marks a link that leaves for the project's own site
const ARROW = `<svg class="ext" viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><path d="M3 1.5h5.5V7M8.5 1.5 1.5 8.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;

// Three cuts at a word, one per width: long (tablets, big screens), mid (two columns on a laptop),
// short (phones). The full text stays in the title
function renderDescription(full: string, cuts: { long: string; mid: string; short: string }): string {
	if (!full) return `<p class="desc desc-none">No description</p>`;
	if (cuts.short === full) return `<p class="desc">${esc(full)}</p>`;
	const text = (["long", "mid", "short"] as const).map((k) => `<span class="d-${k}">${esc(cuts[k])}</span>`).join("");
	return `<p class="desc" title="${esc(full)}">${text}</p>`;
}

function renderDaysOn(repo: Repo, delay: number): string {
	if (repo.isNew) {
		return `<span aria-hidden="true"><span class="stamp" style="animation-delay:${delay}ms" title="First day on GitHub trending">New</span></span><span class="sr-only">New today</span>`;
	}
	const days = repo.daysTrending;
	if (!days) return `<span class="none" aria-hidden="true">–</span><span class="sr-only">No history yet</span>`;
	return `<span aria-hidden="true"><span class="${days >= MID_RUN ? "run" : "plain"}"><span class="on-n${days >= LONG_RUN ? " long" : days >= MID_RUN ? " mid" : ""}">${days}</span><span class="on-l">${days === 1 ? "day" : "days"}</span></span></span><span class="sr-only">Trended on ${days} ${days === 1 ? "day" : "days"}</span>`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Spelled out, because Intl's en-GB short month is "Sept" in some runtimes and "Sep" in others
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Sun 1 Nov 2026" and "16:00", in UTC. Null for a timestamp that doesn't parse, so the masthead drops it
export function chartTime(iso: string): { day: string; time: string } | null {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	const pad = (n: number) => String(n).padStart(2, "0");
	return {
		day: `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
		time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
	};
}

// GitHub descriptions often open with an emoji or a :shortcode:, which breaks the left edge of the column,
// and some carry bare URLs, which only add noise to a one-glance summary
function cleanDescription(text: string): string {
	const cleaned = text
		.replace(/^(?:[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{FE0F}\u{200D}\u{20E3}]|\s|:[a-z0-9_+-]+:)+/u, "")
		// A bare URL goes with any bracket around it; one glued to a word ("git+https://…") is not bare, so it stays
		.replace(/(^|\s)\(?https?:\/\/[^\s)]*[^\s).,;:!?]\)?/g, "$1")
		.replace(/\s{2,}/g, " ")
		.replace(/\s+([.,;:!?])/g, "$1")
		.trim()
		// "Docs: https://…" leaves "Docs:", so a dangling separator goes too
		.replace(/\s*[:\-–—|]$/u, "")
		.trim();
	return cleaned || text.trim();
}

// Shortens text to about `width` Latin characters (a CJK character counts as two), at a word or CJK boundary,
// without trailing punctuation before the ellipsis
export function clip(text: string, width: number): string {
	// By code point, so an emoji is never split in half
	const chars = Array.from(text);
	let used = 0;
	let cut = -1;
	for (let i = 0; i < chars.length; i++) {
		const ch = chars[i];
		const wide = /[\u2E80-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF]/.test(ch);
		used += wide ? 2 : 1;
		if (used > width) {
			const head = chars.slice(0, cut > 0 ? cut : i).join("");
			return `${head.replace(/[\s,.;:!?|\-–—(\[]+$/u, "")}…`;
		}
		// Chinese and Japanese can break after any character; Korean spaces its words, so it breaks at spaces
		const breaksAfter = /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/.test(ch);
		if (ch === " ") cut = i;
		else if (breaksAfter) cut = i + 1;
	}
	return text;
}

function esc(text: string): string {
	return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function formatFull(n: number): string {
	return n.toLocaleString("en-US");
}

function formatCompact(n: number): string {
	return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n).toLowerCase();
}

function hostname(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

export function timeAgo(iso: string, now: Date): string {
	const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes} min ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
	const days = Math.round(hours / 24);
	return `${days} day${days === 1 ? "" : "s"} ago`;
}

// A yellow chart sheet with ruled rows
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#ffde17"/><rect x="5" y="7" width="22" height="6" fill="#111"/><rect x="5" y="16" width="22" height="2.5" fill="#111"/><rect x="5" y="21.5" width="15" height="2.5" fill="#111"/></svg>`;

// Unicode ranges from Google Fonts' latin and latin-ext subsets. Font files are in public/fonts
const LATIN =
	"U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT =
	"U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF";

// Both families are variable fonts, so one file covers every weight we use
const fontFace = (family: string, file: string, weight: string, range: string) =>
	`@font-face { font-family: "${family}"; font-style: normal; font-weight: ${weight}; font-display: swap; src: url(/fonts/${file}) format("woff2"); unicode-range: ${range}; }`;

const CSS = `
${fontFace("Big Shoulders Display", "big-shoulders-display-v24-latin.woff2", "800 900", LATIN)}
${fontFace("Archivo", "archivo-v25-latin.woff2", "400 800", LATIN)}
${fontFace("Archivo", "archivo-v25-latin-ext.woff2", "400 800", LATIN_EXT)}
:root {
	--yellow: #ffde17;
	/* Gain bars: chart yellow is invisible as a thin mark on white, so the light sheet prints them a deep gold */
	--bar: #8a6a00;
	/* The second spot colour, for NEW only */
	--pink: #ff3d8b;
	--black: #111;
	--sheet: #fff;
	--ink: #111;
	--desc: #383838;
	--muted: #444;
	--rule: #d4d4d4;
	--hover: #fff8cc;
	--pos: var(--ink);
	--display: "Big Shoulders Display", "Arial Narrow", sans-serif;
	--text: "Archivo", system-ui, "PingFang SC", "Hiragino Sans", "Microsoft YaHei", "Noto Sans SC", "Noto Sans CJK SC", sans-serif;
	--gutter: 40px;
	color-scheme: light;
}
@media (prefers-color-scheme: dark) {
	:root {
		/* A warm off-white on a lifted sheet: pure white on black glares and blurs */
		--sheet: #161513;
		/* Full-strength yellow glares as a big block on a dark sheet, so it prints a step deeper */
		--yellow: #e7c537;
		--bar: var(--yellow);
		--pink: #f2508f;
		--ink: #e8e4da;
		--desc: #c9c5bb;
		--muted: #d2cec4;
		--rule: #42403b;
		--hover: #24210f;
		/* Positions step back a little so the repo name and the gain lead the row */
		--pos: #c9c5bb;
		color-scheme: dark;
	}
}
* { box-sizing: border-box; }
html { scrollbar-color: var(--muted) var(--sheet); }
body {
	margin: 0;
	background: var(--sheet);
	color: var(--ink);
	font: 400 15px/1.45 var(--text);
	font-variant-numeric: tabular-nums;
	-webkit-font-smoothing: antialiased;
}
/* Light strokes on a dark sheet read thinner, so text gets a little more weight
   and keeps macOS's default rendering. The display face stays crisp */
@media (prefers-color-scheme: dark) {
	body { font-weight: 450; -webkit-font-smoothing: auto; }
	h1, .when-ago, .pos, .on-n, .gain-n, .empty-title { -webkit-font-smoothing: antialiased; }
	/* Dark type on a light ground prints as it does in light mode */
	.mast, .row.one { font-weight: 400; }
	.mast, .row.one, .stale, .stamp { -webkit-font-smoothing: antialiased; }
}
::selection { background: var(--yellow); color: var(--black); }
/* The masthead is yellow already, so its selection reverses to black */
.mast ::selection { background: var(--black); color: var(--yellow); }
p { margin: 0; text-wrap: pretty; }
/* One underline for every link: thin, offset, a quiet tint of the text colour that goes solid on hover */
a { color: inherit; text-underline-offset: 3px; text-decoration-thickness: 1px; text-decoration-color: color-mix(in srgb, currentColor 45%, transparent); }
a:hover { text-decoration-color: currentColor; }
a:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip-path: inset(50%);
	white-space: nowrap;
}

/* Every band shares one measure, so left edges and rules line up down the page */
.mast-in, main, .key, footer { width: min(1440px, 100% - 2 * var(--gutter)); margin-left: auto; margin-right: auto; }

/* Masthead: the yellow band over a heavy rule */
.mast { background: var(--yellow); color: var(--black); border-bottom: 6px solid var(--black); }
.mast-in {
	padding: 16px 0 14px;
	display: grid;
	grid-template-columns: auto minmax(0, 1fr) auto;
	align-items: end;
	gap: 16px 40px;
}
h1 {
	margin: 0;
	font: 900 clamp(60px, 5.8vw, 92px)/.78 var(--display);
	text-transform: uppercase;
	letter-spacing: -.005em;
}
.tag { max-width: 54ch; padding-bottom: 4px; }
.tag-line { white-space: nowrap; font-weight: 800; font-size: 14px; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 4px; }
.tag p:last-child { font-size: 16px; }
.when { display: grid; justify-items: end; text-align: right; }
/* The age leads, because "2 hours ago" needs no time-zone sums; the exact UTC time sits under it */
.when-label { font-weight: 800; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; }
.when-ago { font: 900 32px/.9 var(--display); text-transform: uppercase; margin: 4px 0 6px; }
.when-day { font-weight: 600; font-size: 14px; }

/* Stale warning: a reversed strip across the sheet, the one place the chart admits it is old */
.stale {
	margin: 0;
	padding: 12px var(--gutter);
	background: var(--ink);
	color: var(--sheet);
	font-weight: 600;
	font-size: 14px;
	text-align: center;
}

/* Chart key, like the legend strip on a printed chart: the day's totals, then what the marks mean */
.key {
	padding: 10px 0;
	display: grid;
	gap: 6px;
	font-size: 14px;
	color: var(--muted);
	border-bottom: 1px solid var(--rule);
}
.key-sum { font-size: 14px; color: var(--ink); }
/* The switch says which order the chart is in; screen readers still get the sentence */
.key-rank { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.key strong { color: var(--ink); font-weight: 800; }
.key-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 24px; }
/* Two linked states, the current one filled, so the order reads as a switch and not a footnote */
.sort { display: flex; align-items: center; font-size: 13px; font-weight: 700; }
.sort-l { margin-right: 10px; color: var(--muted); font-weight: 600; }
.sort a { padding: 5px 10px; border: 1.5px solid var(--ink); text-decoration: none; white-space: nowrap; }
.sort a + a { margin-left: -1.5px; }
.sort a[aria-current] { background: var(--ink); color: var(--sheet); }
.sort a[aria-current]::before { content: ""; display: inline-block; width: 8px; height: 4px; margin: 0 7px 0 1px; border-left: 2px solid; border-bottom: 2px solid; transform: rotate(-45deg); vertical-align: 3px; }
.sort a:not([aria-current]):hover { background: var(--hover); }
/* The current option's text is sheet-coloured, so a currentColor ring would vanish on the sheet */
.sort a:focus-visible { outline-color: var(--ink); }
.key-legend { display: grid; grid-template-columns: repeat(4, max-content); align-items: center; gap: 8px 40px; }
.key-sample { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; column-gap: 8px; }
.key-sample > :first-child { justify-self: start; }
.key-days { color: var(--ink); white-space: nowrap; }
.key-days .on-n { font-size: 17px; }
.key-days .on-n.mid { font-size: 16px; }
.key-bar { display: flex; width: 56px; height: 7px; background: color-mix(in srgb, var(--ink) 12%, transparent); }
.key-bar span { width: 50%; background: var(--bar); }

main { padding-top: 0; }
.chart { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 48px; }
.heads, .row { display: grid; grid-template-columns: 40px 86px minmax(0, 1fr) 128px; column-gap: 14px; }
.heads {
	padding: 10px 10px 6px;
	border-bottom: 3px solid var(--ink);
	white-space: nowrap;
	font-weight: 800;
	font-size: 12px;
	line-height: 1.25;
	letter-spacing: .08em;
	text-transform: uppercase;
	align-items: end;
	/* The heads stay in view while the reader scrolls the chart */
	position: sticky;
	top: 0;
	z-index: 1;
	background: var(--sheet);
}

.heads span:nth-child(2) { text-align: center; }
.col:last-child .row:last-child { border-bottom: 0; }
.range { margin-left: 6px; display: none; }
.heads span:last-child { text-align: right; }
.rows { list-style: none; margin: 0; padding: 0; }

/* Each row is one grid: rank and days down the left, name and meta beside the gain,
   then the description and topics run the full width under both */
.row { position: relative; padding: 12px 10px; border-bottom: 1px solid var(--rule); align-items: start; align-content: start; }
.body { display: contents; }
.pos { grid-column: 1; grid-row: 1 / span 4; font: 900 40px/.84 var(--display); color: var(--pos); }
.on { grid-column: 2; grid-row: 1 / span 4; text-align: center; padding-top: 3px; }
.name { grid-column: 3; grid-row: 1; justify-self: start; min-width: 0; }
.by { grid-column: 3; grid-row: 2; }
.gain { grid-column: 4; grid-row: 1 / span 2; }
.desc { grid-column: 3 / -1; grid-row: 3; }
.topics { grid-column: 3 / -1; grid-row: 4; }
.row:hover { background: var(--hover); }
/* Every count prints in ink, with a condensed unit */
.on-n { font: 800 23px/1 var(--display); color: var(--ink); }
/* A run of 4 days or more prints boxed in ink, number and unit together, the same shape as NEW.
   Inside the No. 1 band it prints yellow on black */
.run { display: inline-block; padding: 3px 6px 2px; background: var(--ink); color: var(--sheet); white-space: nowrap; }
.run .on-n, .run .on-l { color: inherit; }
.on-n.mid { font-size: 22px; }
/* A long run prints larger in its box, still well below rank scale */
.on-n.long { font-size: 26px; font-weight: 900; }
.on-l { margin-left: 5px; font: 700 18px/1 var(--display); letter-spacing: .04em; text-transform: uppercase; color: var(--ink); }
.none { display: block; font-size: 15px; color: var(--muted); }
.name {
	font-weight: 800;
	font-size: 17px;
	line-height: 1.2;
	text-decoration: none;
	overflow-wrap: anywhere;
}
/* "owner / name" is one link; the owner is quieter, and a long pair breaks before the name, never inside it */
.who { font-weight: 500; color: var(--muted); }
.repo { display: inline-block; max-width: 100%; }
/* A quiet underline on the name says "link"; it goes full ink on hover */
.repo {
	text-decoration: underline;
	text-decoration-thickness: 1px;
	text-underline-offset: 3px;
	text-decoration-color: color-mix(in srgb, currentColor 45%, transparent);
}
.row:hover .repo, .name:hover .repo { text-decoration-color: currentColor; }
/* Where it is narrow (phones, and two columns on a laptop), the owner prints on a small line over the name,
   so every row has the same shape and a long pair never wraps at random */
@media (max-width: 640px), (min-width: 1101px) and (max-width: 1439px) {
	.name { display: block; }
	.who { display: block; font-size: 14px; margin-bottom: 3px; }
	.sep { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
}
.name:focus-visible { outline: none; }
.row:has(.name:focus-visible) { outline: 2px solid var(--ink); outline-offset: -2px; }
.by {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 2px 14px;
	margin-top: 4px;
	font-size: 14px;
	color: var(--muted);
}
.lang, .total { display: inline-flex; align-items: center; gap: 5px; }
.star { flex: none; }
.swatch { width: 10px; height: 10px; filter: saturate(.75); }
/* The project's own site is a secondary link: grey with an arrow, underlined on hover,
   so each row has one underlined link, the repository */
.site { display: inline-flex; align-items: center; gap: 4px; text-decoration: none; }
.site:hover { color: var(--ink); text-decoration: underline; }
.ext { flex: none; }
.desc {
	margin-top: 5px;
	font-size: 14px;
	color: var(--desc);
	overflow-wrap: anywhere;
}
/* A safety net: the server's cut nearly always fits two lines already */
.desc { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
.desc-none { color: var(--muted); font-style: italic; }
.d-mid, .d-short { display: none; }
@media (min-width: 1101px) and (max-width: 1499px) {
	.d-long { display: none; }
	.d-mid { display: inline; }
}
.topics { display: flex; flex-wrap: wrap; gap: 0 8px; margin-top: 3px; font-size: 13.5px; color: var(--muted); }
.t { white-space: nowrap; }
.t + .t::before { content: "·"; margin-right: 8px; }
.gain { text-align: right; padding-top: 1px; }
.gain-n { display: inline-block; font: 800 24px/.9 var(--display); }
/* A bar under each gain (gold on the light sheet, yellow on the dark one, black on the No. 1 band),
   scaled to the day's biggest, so the unsorted column still compares and the masthead's colour runs down the chart */
.bar { display: flex; height: 7px; margin-top: 6px; background: color-mix(in srgb, var(--ink) 12%, transparent); }
.bar span { background: var(--bar); }
/* In GitHub's order the day's biggest gain prints on a reversed chip: ink, or yellow on black on the No. 1 band */
.top .gain-n { background: var(--ink); color: var(--sheet); padding: 4px 6px 2px; margin: -4px 0 -2px; }

/* No. 1 prints on a yellow band, the masthead's colour, in black type. The tokens remap inside it,
   so every element keeps its role: grey text is a deep gold, boxed runs and the top-gain chip print yellow on black */
.row.one, .row.one:hover {
	--ink: var(--black);
	--pos: var(--black);
	--desc: #3b3000;
	--muted: #3b3000;
	--sheet: var(--yellow);
	background: var(--yellow);
	color: var(--ink);
	border-bottom-color: var(--black);
}
.one .bar span { background: var(--black); }
.row.one ::selection { background: var(--black); color: var(--yellow); }
/* All type on the band is black, so the name's underline is stronger to still say "link" */
.row.one .repo { text-decoration-color: color-mix(in srgb, currentColor 60%, transparent); }
.row.one:hover .repo, .row.one .name:hover .repo { text-decoration-color: currentColor; }
/* Pink on yellow barely separates, so a NEW tag on the band gets a black edge */
.row.one .stamp { box-shadow: inset 0 0 0 1.5px var(--black); }
/* A yellow language swatch would vanish on the band, so swatches there get a thin dark edge */
.row.one .swatch { outline: 1px solid color-mix(in srgb, var(--black) 40%, transparent); outline-offset: -1px; }
/* The band closes with its black rule even when it is the last row in a column */
.col:last-child .row.one:last-child, .rows .row.one:last-child { border-bottom: 1px solid var(--black); }
.one .pos { font-size: 44px; color: var(--ink); }
.one .on { padding-top: 8px; }

.stamp {
	display: inline-block;
	/* A small pink tag, the one place the second spot colour prints */
	padding: 3px 5px 2px;
	background: var(--pink);
	color: var(--black);
	font: 800 15px/1 var(--display);
	letter-spacing: .06em;
	text-transform: uppercase;
	animation: stamp .42s cubic-bezier(.16, 1, .3, 1) both;
}
.stamp-key { animation: none; }
@keyframes stamp {
	from { transform: scale(1.9); }
	to { transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
	.stamp { animation: none; }
}

.empty { padding: 72px 0; }
.empty-title { font: 900 48px/1 var(--display); text-transform: uppercase; margin-bottom: 8px; }

footer {
	margin-top: 24px;
	padding: 18px 0 40px;
	border-top: 3px solid var(--ink);
	display: flex;
	justify-content: space-between;
	gap: 8px 24px;
	flex-wrap: wrap;
	font-size: 14px;
	color: var(--muted);
}
.foot-links { display: flex; flex-wrap: wrap; gap: 4px 22px; font-weight: 600; font-size: 14px; color: var(--ink); }

/* Wide screens print both columns at chart density: one line each for name, meta and description */
@media (min-width: 1101px) {
	/* Row N on the left and row N on the right share one grid row, so the columns stay in step
	   and each pair is only as tall as its taller row */
	.chart { grid-template-rows: auto repeat(var(--rows), auto); }
	.col { grid-row: 1 / -1; display: grid; grid-template-rows: subgrid; }
	.rows { grid-row: 2 / -1; display: grid; grid-template-rows: subgrid; }
	.row { padding: 7px 10px; }
	.pos { font-size: 36px; }
	.gain-n { font-size: 22px; }
	.range { display: inline; }
	/* A hairline down the gutter keeps the two columns reading top to bottom */
	.chart { column-gap: 0; }
	.col:first-child { padding-right: 24px; }
	/* The footer rule closes the chart, so the last rows drop their own hairline */
	.rows .row:last-child { border-bottom: 0; }
	.key-legend { display: flex; flex-wrap: wrap; gap: 8px 40px; }
	.col + .col { border-left: 2px solid var(--ink); padding-left: 24px; }
	.name { line-height: 1.15; }
	/* Forks go to screen readers only. The homepage takes whatever is left of the line:
	   if it doesn't fit, it wraps inside its slot onto a clipped second line, so it drops
	   out whole instead of printing a cut-off fragment. Nothing else on the line is clipped */
	.by { margin-top: 3px; }
	.site-slot { flex: 1 1 0; min-width: 0; height: 19px; overflow: hidden; display: flex; flex-wrap: wrap; row-gap: 4px; }
	.site-slot::before { content: ""; height: 19px; }
	.site-slot:focus-within { height: auto; overflow: visible; }
	.forks { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
	.desc { margin-top: 4px; line-height: 1.4; }
	.topics { display: none; }
	.one .pos { font-size: 42px; }
}
/* Big screens have room for text a size up */
@media (min-width: 1500px) {
	.key-sum { font-size: 15px; }
	.name { font-size: 18px; }
	.by { font-size: 15px; }
	.desc { font-size: 15px; }
	.site-slot, .site-slot::before { height: 20px; }
	.heads, .row { grid-template-columns: 40px 86px minmax(0, 1fr) 160px; }
}
@media (min-width: 641px) and (max-width: 1100px) {
	.sort a { padding: 12px 14px; }
	.key-legend { grid-template-columns: auto minmax(0, 1fr); column-gap: 40px; }
	.pos { font-size: 38px; }
	.name { font-size: 18px; }
}
/* Below desktop the legend wraps, so samples sit in one fixed column and their text lines up */
@media (max-width: 1100px) {
	/* One column: the sections give up their boxes, so the first heads stay stuck the whole way down */
	.col { display: contents; }
	.key-sample { grid-template-columns: 60px minmax(0, 1fr); }
	/* The dateline stands beside the title, and the strapline sits under it */
	.mast-in { grid-template-columns: minmax(0, 1fr) auto; }
	h1 { grid-column: 1; grid-row: 1; }
	.tag { grid-column: 1; grid-row: 2; }
	.when { grid-column: 2; grid-row: 1 / span 2; align-self: end; }
	.chart { grid-template-columns: minmax(0, 1fr); }
	.col + .col .heads { display: none; }
}
@media (max-width: 640px) {
	:root { --gutter: 16px; }
	.mast-in { grid-template-columns: minmax(0, 1fr); padding: 18px 0 14px; gap: 10px; }
	h1, .tag, .when { grid-column: 1; grid-row: auto; }
	/* One line: "TRENDING REPOS" sets about 6em wide */
	h1 { font-size: min(12.5vw, 64px); white-space: nowrap; }
	/* The key below says what the chart is, so the masthead keeps only the strapline */
	.tag p:last-child { display: none; }
	/* One line, "UPDATED 2 HOURS AGO", over the exact time */
	.when { justify-items: start; text-align: left; }
	.when-label { display: none; }
	.when-ago { font-size: 18px; margin: 0 0 3px; }
	.when-ago::before { content: "Updated "; }

	/* Legend text, the switch and the repository column share one left edge */
	.key-legend { grid-template-columns: minmax(0, 1fr); gap: 6px; }
	.key-sample { grid-template-columns: 52px minmax(0, 1fr); column-gap: 12px; }
	.sort-l { width: 52px; margin-right: 12px; }
	.key-bars { display: none; }
	.heads { padding: 12px 0 7px; letter-spacing: .06em; }
	.heads, .row { grid-template-columns: 52px minmax(0, 1fr) auto; column-gap: 12px; }
	/* "Days" heads the left column under "Rank", as the cells stack */
	.heads { grid-template-rows: auto auto; }
	.heads > span:nth-child(1) { grid-column: 1; grid-row: 1; }
	.heads > span:nth-child(2) { grid-column: 1; grid-row: 2; text-align: left; }
	.h-d2 { display: none; }
	.heads > span:nth-child(3) { grid-column: 2; grid-row: 1 / span 2; }
	.heads > span:nth-child(4) { grid-column: 3; grid-row: 1 / span 2; }
	.row { padding: 14px 0; }
	.pos { grid-column: 1; font-size: 34px; }
	/* Days on sits right under the rank and reads as one unit, "3 days" */
	.on { grid-column: 1; margin-top: 38px; padding-top: 0; text-align: left; white-space: nowrap; }
	.on-n { font-size: 20px; }
	/* Boxed runs stack number over unit, so a two-digit run still fits the narrow column */
	.on .run { display: inline-flex; flex-direction: column; align-items: center; padding: 4px 6px 3px; }
	.on .run .on-l { margin: 2px 0 0; font-size: 14px; }
	.on-n.mid { font-size: 22px; }
	.on-n.long { font-size: 24px; }
	.name { grid-column: 2; font-size: 18px; }
	.gain { grid-column: 3; grid-row: 1; }
	.by, .topics { grid-column: 2 / -1; }
	.desc { grid-column: 2 / -1; }
	.by { margin-top: 5px; }
	.forks { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
	.topics { display: none; }
	.gain-n { font-size: 22px; }
	.bar { display: none; }
	.one .pos { font-size: 44px; }
	.one .on { margin-top: 43px; padding-top: 0; }
	/* Phone rows have no side padding, so the band reaches into the gutter to keep its type off the edge */
	.row.one { margin: 0 -10px; padding: 14px 10px; }
	/* The stuck heads cover that reach too, so the band never shows beside them as it scrolls under */
	.heads::before, .heads::after { content: ""; position: absolute; top: 0; bottom: -3px; width: 10px; background: var(--sheet); }
	.heads::before { left: -10px; }
	.heads::after { right: -10px; }
	/* The gain sits level with the repo name, not the owner line above it */
	.gain { align-self: end; }
	/* Taps land on the name and the homepage even a little off the text */
	.name, .site { position: relative; }
	.name::after, .site::after { content: ""; position: absolute; inset: -10px -6px; }
	footer { flex-direction: column; }
	.d-long, .d-mid { display: none; }
	.d-short { display: inline; }
	.foot-links { gap: 0 18px; }
	.foot-links a { padding: 10px 0; }
	.sort a { padding: 12px 12px; }

}
`;
