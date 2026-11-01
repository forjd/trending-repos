import type { Repo, Snapshot } from "./types";

// The cron runs every 4 hours, so this is three missed runs in a row
export const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

export function isStale(fetchedAt: string, now: Date): boolean {
	return now.getTime() - Date.parse(fetchedAt) > STALE_AFTER_MS;
}

// History in D1 starts here, so "days on" can't count further back
const HISTORY_START = "5 Oct 2026";
// A run this long prints heavier in "Days on", so staying power reads at a glance
const LONG_RUN = 7;

export function renderPage(snapshot: Snapshot | null, now = new Date()): string {
	const repos = snapshot?.repos ?? [];
	const totalToday = repos.reduce((sum, r) => sum + r.starsToday, 0);
	const newCount = repos.filter((r) => r.isNew).length;
	// Only worth calling out when there is something to beat; on a tie the higher position wins
	const topGainAt =
		repos.length > 1 ? repos.reduce((best, r, i) => (r.starsToday > repos[best].starsToday ? i : best), 0) : -1;

	// Two printed columns on wide screens; one list order for everything else
	const half = Math.ceil(repos.length / 2);
	const columns = [repos.slice(0, half), repos.slice(half)].filter((c) => c.length);

	const chart = repos.length
		? `<div class="chart">${columns
				.map(
					(col, c) => `
		<section class="col"${c ? ` aria-label="Positions ${half + 1} to ${repos.length}"` : ` aria-label="Positions 1 to ${col.length}"`}>
			<div class="heads" aria-hidden="true"><span>This chart</span><span>Days on</span><span>Repository</span><span>Stars today</span></div>
			<ol class="rows" role="list" start="${c * half + 1}">${col.map((r, i) => renderRow(r, c * half + i + 1, c * half + i === topGainAt)).join("")}</ol>
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
<title>Trending Repos: GitHub trending, with memory</title>
<meta name="description" content="The repositories gaining the most stars on GitHub today, charted every four hours with how many days each has trended.">
<meta name="theme-color" content="#ffde17">
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
			<p>The repositories gaining the most stars on GitHub today, charted every four hours with how long each one has been on the chart.</p>
		</div>
		${
			when && snapshot
				? `<p class="when">
			<span class="when-day">Chart of ${when.day}</span>
			<time class="when-time" datetime="${esc(snapshot.fetchedAt)}">${when.time}</time>
			<span class="when-ago">UTC · updated ${timeAgo(snapshot.fetchedAt, now)}</span>
		</p>`
				: ""
		}
	</div>
</header>
${stale}
${
	repos.length
		? `<div class="key">
	<p><strong>${repos.length}</strong> repos gained <strong>${formatFull(totalToday)}</strong> stars today${newCount ? `, <strong>${newCount}</strong> of them new` : ""}</p>
	${newCount ? `<p><span class="stamp stamp-key" aria-hidden="true">New</span> first seen on trending today</p>` : ""}
	<p><strong>Days on:</strong> different days on GitHub trending since ${HISTORY_START}</p>
	<p>Positions follow GitHub's own trending order</p>
</div>`
		: ""
}
<main>
	${chart}
</main>
<footer>
	<p>Data from <a href="https://github.com/trending">github.com/trending</a> and the GitHub API. Not affiliated with GitHub.</p>
	<p class="foot-links"><a href="/api/trending">JSON</a><a href="https://github.com/forjd/trending-repos">Source</a></p>
</footer>
</body>
</html>`;
}

function renderRow(repo: Repo, position: number, isTopGain: boolean): string {
	const topics = (repo.topics ?? []).slice(0, 3);
	const homepage = repo.homepage && /^https?:\/\//i.test(repo.homepage) ? repo.homepage : null;
	const langColor = repo.languageColor && /^#[\da-f]{3,8}$/i.test(repo.languageColor) ? repo.languageColor : null;
	const delay = Math.min(position, 25) * 40;

	return `
		<li class="row${position === 1 ? " one" : ""}">
			<span class="pos">${position}</span>
			<span class="on">${renderDaysOn(repo, delay)}</span>
			<div class="body">
				<a class="name" href="${esc(repo.url)}"><span class="sr-only">${esc(repo.owner)} / </span>${esc(repo.name)}</a>
				<p class="by">
					<img class="avatar" src="${esc(repo.avatarUrl)}" alt="" width="16" height="16" loading="lazy">
					<span>${esc(repo.owner)}</span>
					${repo.language ? `<span class="lang">${langColor ? `<span class="swatch" style="background:${langColor}"></span>` : ""}${esc(repo.language)}</span>` : ""}
					<span title="${formatFull(repo.stars)} stars"><span aria-hidden="true">${formatCompact(repo.stars)} stars</span><span class="sr-only">${formatFull(repo.stars)} stars</span></span>
					<span class="forks" title="${formatFull(repo.forks)} forks"><span aria-hidden="true">${formatCompact(repo.forks)} forks</span><span class="sr-only">${formatFull(repo.forks)} forks</span></span>
					${homepage ? `<span class="site-slot"><a class="site" href="${esc(homepage)}" rel="nofollow ugc noopener">${esc(hostname(homepage))}</a></span>` : ""}
				</p>
				${repo.description ? `<p class="desc" title="${esc(repo.description)}">${esc(repo.description)}</p>` : ""}
				${topics.length ? `<p class="topics"><span class="sr-only">Topics: </span>${topics.map((t) => esc(t)).join(" · ")}</p>` : ""}
			</div>
			<p class="gain">
				<span class="gain-n">+${formatFull(repo.starsToday)}</span>
				<span class="gain-l${isTopGain ? " top" : ""}">${isTopGain ? "top gain today" : "stars today"}</span>
			</p>
		</li>`;
}

function renderDaysOn(repo: Repo, delay: number): string {
	if (repo.isNew) {
		return `<span class="stamp" style="animation-delay:${delay}ms" aria-hidden="true">New</span><span class="sr-only">New today</span>`;
	}
	const days = repo.daysTrending;
	if (!days) return `<span class="none" aria-hidden="true">–</span><span class="sr-only">No history yet</span>`;
	return `<span aria-hidden="true"><span class="on-n${days >= LONG_RUN ? " long" : ""}">${days}</span><span class="on-l">${days === 1 ? "day" : "days"}</span></span><span class="sr-only">Trended on ${days} ${days === 1 ? "day" : "days"}</span>`;
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

// A yellow chart sheet with ruled rows and a reversed No. 1 row
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
	--pink: #ff3d8b;
	--black: #111;
	--sheet: #fff;
	--ink: #111;
	--muted: #595959;
	--rule: #d4d4d4;
	--hover: #fff8cc;
	--one-bg: #111;
	--one-fg: #fff;
	--one-muted: #b8b8b8;
	--one-gain: #ffde17;
	--display: "Big Shoulders Display", "Arial Narrow", sans-serif;
	--text: "Archivo", system-ui, sans-serif;
	color-scheme: light;
}
@media (prefers-color-scheme: dark) {
	:root {
		--sheet: #121212;
		--ink: #f0f0f0;
		--muted: #a6a6a6;
		--rule: #333;
		--hover: #1f1d12;
		--one-bg: #ffde17;
		--one-fg: #111;
		--one-muted: #4a4220;
		--one-gain: #111;
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
::selection { background: var(--yellow); color: var(--black); }
p { margin: 0; }
a { color: inherit; text-underline-offset: 3px; text-decoration-thickness: 1px; }
a:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip-path: inset(50%);
	white-space: nowrap;
}

/* Masthead: the yellow band over a heavy rule */
.mast { background: var(--yellow); color: var(--black); border-bottom: 6px solid var(--black); }
.mast-in {
	max-width: 1520px;
	margin: 0 auto;
	padding: 26px 40px 22px;
	display: grid;
	grid-template-columns: auto minmax(0, 1fr) auto;
	align-items: end;
	gap: 16px 40px;
}
h1 {
	margin: 0;
	font: 900 clamp(64px, 8.4vw, 124px)/.78 var(--display);
	text-transform: uppercase;
	letter-spacing: -.005em;
}
.tag { max-width: 46ch; padding-bottom: 4px; }
.tag-line { font-weight: 800; font-size: 14px; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 4px; }
.tag p:last-child { font-size: 14px; }
.when { display: grid; justify-items: end; text-align: right; font-weight: 800; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
.when-time { font: 900 72px/.82 var(--display); letter-spacing: 0; margin: 4px 0 3px; }
.when-ago { font-weight: 600; letter-spacing: .02em; text-transform: none; font-size: 13px; }

/* Stale warning: a reversed strip across the sheet, the one place the chart admits it is old */
.stale {
	margin: 0;
	padding: 12px 40px;
	background: var(--ink);
	color: var(--sheet);
	font-weight: 600;
	font-size: 14px;
	text-align: center;
}

/* Chart key, like the legend strip on a printed chart */
.key {
	max-width: 1520px;
	margin: 0 auto;
	padding: 14px 40px;
	display: flex;
	flex-wrap: wrap;
	gap: 8px 36px;
	font-size: 13px;
	color: var(--muted);
	border-bottom: 1px solid var(--rule);
}
.key strong { color: var(--ink); font-weight: 800; }
.key p { display: flex; align-items: center; gap: 8px; }

main { max-width: 1520px; margin: 0 auto; padding: 8px 40px 0; }
.chart { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 48px; }
.heads, .row { display: grid; grid-template-columns: 56px 52px minmax(0, 1fr) 104px; column-gap: 14px; }
.heads {
	padding: 14px 0 7px;
	border-bottom: 3px solid var(--ink);
	font-weight: 800;
	font-size: 10.5px;
	line-height: 1.25;
	letter-spacing: .09em;
	text-transform: uppercase;
}
.heads span:nth-child(2), .heads span:last-child { text-align: right; }
.rows { list-style: none; margin: 0; padding: 0; }

.row { position: relative; padding: 12px 0; border-bottom: 1px solid var(--rule); align-items: start; }
.row:hover { background: var(--hover); }
.row:hover .name { text-decoration: underline; }
.pos { font: 900 46px/.84 var(--display); }
.on { text-align: right; padding-top: 3px; }
.on-n { display: block; font: 800 22px/1 var(--display); }
/* A long run gets a heavier numeral and a rule under it, still well below position scale */
.on-n.long { font-size: 26px; font-weight: 900; padding-bottom: 2px; border-bottom: 3px solid currentColor; display: inline-block; }
.on-l, .none { display: block; font-size: 11px; color: var(--muted); }
.none { font-size: 15px; }
.body { min-width: 0; }
.name {
	font-weight: 800;
	font-size: 17px;
	line-height: 1.2;
	text-decoration: none;
	overflow-wrap: anywhere;
}
.name:focus-visible { outline: none; }
.row:has(.name:focus-visible) { outline: 2px solid var(--ink); outline-offset: -2px; }
.row.one:has(.name:focus-visible) { outline-color: var(--one-gain); outline-offset: -4px; }
.by {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 2px 12px;
	margin-top: 3px;
	font-size: 13px;
	color: var(--muted);
}
.avatar { width: 16px; height: 16px; margin-right: -6px; background: var(--rule); }
.lang { display: inline-flex; align-items: center; gap: 5px; }
.swatch { width: 9px; height: 9px; }
.site { text-decoration: underline; }
.site:hover { color: var(--ink); }
.desc {
	margin-top: 4px;
	font-size: 14px;
	max-width: 68ch;
	overflow-wrap: anywhere;
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	overflow: hidden;
}
.topics { margin-top: 3px; font-size: 12px; color: var(--muted); }
.gain { text-align: right; padding-top: 1px; }
.gain-n { display: block; font: 800 28px/.9 var(--display); }
.gain-l { display: block; margin-top: 4px; font-size: 11px; color: var(--muted); }

/* No. 1 prints reversed */
.row.one { background: var(--one-bg); color: var(--one-fg); padding: 16px 14px; margin: 0 -14px; border-bottom: 0; }
.one .pos { font-size: 76px; }
.one .name { font-size: 23px; }
.one .by, .one .on-l, .one .gain-l, .one .topics { color: var(--one-muted); }
.one .gain-n { font-size: 40px; color: var(--one-gain); }

.stamp {
	display: inline-block;
	padding: 4px 6px 3px;
	background: var(--pink);
	color: var(--black);
	font-weight: 800;
	font-size: 10.5px;
	line-height: 1;
	letter-spacing: .1em;
	text-transform: uppercase;
	transform: rotate(-5deg);
	animation: stamp .42s cubic-bezier(.16, 1, .3, 1) both;
}
.stamp-key { animation: none; }
@keyframes stamp {
	from { transform: scale(1.9) rotate(-14deg); }
	to { transform: scale(1) rotate(-5deg); }
}
@media (prefers-reduced-motion: reduce) {
	.stamp { animation: none; }
}

.empty { padding: 72px 0; }
.empty-title { font: 900 48px/1 var(--display); text-transform: uppercase; margin-bottom: 8px; }

footer {
	max-width: 1520px;
	margin: 48px auto 0;
	padding: 18px 40px 40px;
	border-top: 3px solid var(--ink);
	display: flex;
	justify-content: space-between;
	gap: 8px 24px;
	flex-wrap: wrap;
	font-size: 13px;
	color: var(--muted);
}
.foot-links { display: flex; gap: 20px; font-weight: 800; color: var(--ink); }

/* Wide screens print both columns at chart density: one line each for meta and description */
@media (min-width: 1101px) {
	.row { padding: 8px 0; }
	.pos { font-size: 40px; }
	.name { line-height: 1.15; }
	/* Forks go to screen readers only. The homepage takes whatever is left of the line:
	   if it doesn't fit, it wraps inside its slot onto a clipped second line, so it drops
	   out whole instead of printing a cut-off fragment. Nothing else on the line is clipped */
	.by { margin-top: 1px; }
	.site-slot { flex: 1 1 0; min-width: 0; height: 19px; overflow: hidden; display: flex; flex-wrap: wrap; row-gap: 4px; }
	.site-slot::before { content: ""; height: 19px; }
	.site-slot:focus-within { height: auto; overflow: visible; }
	.forks { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
	.desc { -webkit-line-clamp: 1; line-clamp: 1; margin-top: 1px; line-height: 1.35; }
	.topics { display: none; }
	.gain-l:not(.top) { display: none; }
	.row.one { padding: 12px 14px; }
}
@media (max-width: 1100px) {
	.mast-in { grid-template-columns: minmax(0, 1fr) auto; }
	h1 { grid-column: 1 / -1; }
	.chart { grid-template-columns: minmax(0, 1fr); }
	.col + .col .heads { display: none; }
}
@media (max-width: 640px) {
	.mast-in, .key, main, footer, .stale { padding-left: 16px; padding-right: 16px; }
	.mast-in { grid-template-columns: minmax(0, 1fr); padding-top: 20px; gap: 12px; }
	h1 { font-size: clamp(52px, 17vw, 72px); }
	.when { justify-items: start; justify-content: start; text-align: left; grid-template-columns: auto auto; align-items: baseline; column-gap: 10px; }
	.when-day { grid-column: 1 / -1; }
	.when-time { font-size: 44px; margin: 2px 0 0; }
	.key { gap: 6px 20px; }
	.heads, .row { grid-template-columns: 40px minmax(0, 1fr) auto; column-gap: 12px; }
	.row { grid-template-rows: auto 1fr; }
	.heads span:nth-child(2) { display: none; }
	.heads span:nth-child(3) { grid-column: 2; }
	.pos { font-size: 36px; grid-row: 1; }
	.on { grid-column: 1; grid-row: 2; align-self: start; text-align: left; padding-top: 6px; }
	.desc { -webkit-line-clamp: 3; line-clamp: 3; }
	.on-n { font-size: 20px; }
	.on-n.long { font-size: 22px; }
	.body { grid-column: 2; grid-row: 1 / span 2; }
	.gain { grid-column: 3; grid-row: 1 / span 2; }
	.gain-n { font-size: 24px; }
	.row.one { padding: 14px 16px; margin: 0 -16px; }
	.one .pos { font-size: 52px; }
	.one .name { font-size: 20px; }
	.one .gain-n { font-size: 30px; }
	footer { flex-direction: column; }
}
`;
