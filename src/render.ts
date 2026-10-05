import type { Repo, Snapshot } from "./types";

export function renderPage(snapshot: Snapshot | null, now = new Date()): string {
	const repos = snapshot?.repos ?? [];
	const maxToday = Math.max(1, ...repos.map((r) => r.starsToday));
	const totalToday = repos.reduce((sum, r) => sum + r.starsToday, 0);

	const summary = snapshot
		? `<p class="summary">
				<strong>${repos.length}</strong> repos gained <strong>${formatFull(totalToday)}</strong> stars today
				<span class="sep" aria-hidden="true">·</span>
				updated <time datetime="${esc(snapshot.fetchedAt)}" title="${esc(snapshot.fetchedAt)}">${timeAgo(snapshot.fetchedAt, now)}</time>
			</p>`
		: "";

	const body = repos.length
		? `<ol class="repos" role="list">${repos.map((r, i) => renderRepo(r, i + 1, maxToday)).join("")}</ol>`
		: `<div class="empty"><p>No trending data yet.</p><p class="muted">The first scrape runs on the next 4-hour tick.</p></div>`;

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Trending Repos</title>
<meta name="description" content="The repositories gaining the most stars on GitHub today, refreshed every four hours.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>★</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<main>
	<header class="masthead">
		<p class="eyebrow">GitHub Trending · Today</p>
		<h1>What developers are <em>starring</em> right now</h1>
		${summary}
	</header>
	${body}
	<footer>
		<span>Data from <a href="https://github.com/trending">github.com/trending</a>, refreshed every four hours.</span>
		<a href="/api/trending">JSON</a>
	</footer>
</main>
</body>
</html>`;
}

function renderRepo(repo: Repo, rank: number, maxToday: number): string {
	const share = Math.max(2, Math.round((repo.starsToday / maxToday) * 100));
	const topics = (repo.topics ?? []).slice(0, 4);
	const homepage = repo.homepage && /^https?:\/\//i.test(repo.homepage) ? repo.homepage : null;
	const langColor = repo.languageColor && /^#[\da-f]{3,8}$/i.test(repo.languageColor) ? repo.languageColor : "var(--muted)";

	return `
	<li class="repo">
		<span class="rank">${String(rank).padStart(2, "0")}</span>
		<div class="main">
			<div class="title-row">
				<a class="title" href="${esc(repo.url)}">
					<img class="avatar" src="${esc(repo.avatarUrl)}" alt="" width="32" height="32" loading="lazy">
					<span><span class="owner">${esc(repo.owner)} /</span> <span class="name">${esc(repo.name)}</span></span>
				</a>
				${renderBadges(repo)}
			</div>
			${repo.description ? `<p class="desc">${esc(repo.description)}</p>` : ""}
			${topics.length ? `<ul class="topics" role="list">${topics.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
			<p class="meta">
				${repo.language ? `<span class="lang"><span class="dot" style="background:${langColor}"></span>${esc(repo.language)}</span>` : ""}
				<span title="${formatFull(repo.stars)} stars"><span aria-hidden="true">★ ${formatCompact(repo.stars)}</span><span class="sr-only">${formatFull(repo.stars)} stars</span></span>
				<span title="${formatFull(repo.forks)} forks"><span aria-hidden="true">⑂ ${formatCompact(repo.forks)}</span><span class="sr-only">${formatFull(repo.forks)} forks</span></span>
				${homepage ? `<a class="site" href="${esc(homepage)}" rel="nofollow ugc noopener">${esc(hostname(homepage))} ↗</a>` : ""}
			</p>
		</div>
		<div class="today">
			<span class="today-count">+${formatFull(repo.starsToday)}</span>
			<span class="today-label">stars today</span>
			<span class="bar" aria-hidden="true"><span style="width:${share}%"></span></span>
		</div>
	</li>`;
}

function renderBadges(repo: Repo): string {
	if (repo.isNew) return `<span class="badge badge-new">New today</span>`;
	// One day on trending is just today, so it says nothing
	if (repo.daysTrending && repo.daysTrending >= 2) {
		return `<span class="badge" title="Seen on GitHub trending on ${repo.daysTrending} different days">${repo.daysTrending} days trending</span>`;
	}
	return "";
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

const CSS = `
:root {
	--bg: #f6f3ee;
	--surface: #fffdf9;
	--border: #e6e0d6;
	--text: #1c1a17;
	--muted: #6b645e;
	--accent: #c2410c;
	--accent-soft: #fbe5d6;
	--chip: #efe9e0;
	--serif: "Instrument Serif", Georgia, serif;
	--sans: "Inter", system-ui, sans-serif;
	--mono: "JetBrains Mono", ui-monospace, monospace;
	color-scheme: light;
}
@media (prefers-color-scheme: dark) {
	:root {
		--bg: #12110f;
		--surface: #1a1916;
		--border: #2c2a26;
		--text: #f1ece4;
		--muted: #9a938a;
		--accent: #fb923c;
		--accent-soft: #3a2415;
		--chip: #25231f;
		color-scheme: dark;
	}
}
* { box-sizing: border-box; }
body {
	margin: 0;
	background: var(--bg);
	color: var(--text);
	font: 15px/1.55 var(--sans);
	-webkit-font-smoothing: antialiased;
}
a { color: inherit; }
main { max-width: 880px; margin: 0 auto; padding: 72px 16px 48px; }

.masthead { margin-bottom: 40px; }
.eyebrow {
	margin: 0 0 12px;
	font: 600 12px/1 var(--mono);
	letter-spacing: .12em;
	text-transform: uppercase;
	color: var(--accent);
}
h1 {
	margin: 0;
	font: 400 clamp(40px, 7vw, 64px)/1.02 var(--serif);
	letter-spacing: -.01em;
	max-width: 17ch;
}
h1 em { color: var(--accent); }
.summary { margin: 20px 0 0; color: var(--muted); }
.summary strong { color: var(--text); font-weight: 600; }
.sep { margin: 0 6px; }

.repos { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.repo {
	display: grid;
	grid-template-columns: 44px 1fr 150px;
	gap: 20px;
	padding: 22px 24px;
	background: var(--surface);
	border: 1px solid var(--border);
	border-radius: 14px;
	transition: border-color .15s, transform .15s;
}
.repo:hover { border-color: var(--accent); transform: translateY(-1px); }
.rank {
	font: 400 30px/1 var(--serif);
	color: var(--muted);
	padding-top: 2px;
}
.repo:first-child .rank { color: var(--accent); }
.main { min-width: 0; }
.title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; }
.badge {
	padding: 2px 9px;
	border-radius: 999px;
	border: 1px solid var(--border);
	color: var(--muted);
	font: 600 11px/1.6 var(--mono);
	letter-spacing: .04em;
	text-transform: uppercase;
	white-space: nowrap;
}
.badge-new { border-color: transparent; background: var(--accent); color: var(--surface); }
.title {
	display: flex;
	align-items: center;
	gap: 10px;
	text-decoration: none;
	font-size: 18px;
	line-height: 1.3;
}
.title:hover .name { text-decoration: underline; text-underline-offset: 3px; }
.avatar { border-radius: 8px; flex: none; background: var(--chip); }
.owner { color: var(--muted); }
.name { font-weight: 600; overflow-wrap: anywhere; }
.desc { margin: 10px 0 0; overflow-wrap: anywhere; }
.topics { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.topics li {
	padding: 2px 9px;
	border-radius: 999px;
	background: var(--chip);
	color: var(--muted);
	font: 12px/1.6 var(--mono);
}
.meta {
	margin: 14px 0 0;
	display: flex;
	flex-wrap: wrap;
	gap: 6px 18px;
	color: var(--muted);
	font: 13px/1.4 var(--mono);
}
.lang { display: inline-flex; align-items: center; gap: 6px; }
.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip-path: inset(50%);
	white-space: nowrap;
}
.dot { width: 10px; height: 10px; border-radius: 50%; }
.site { text-decoration: none; }
.site:hover { color: var(--accent); }

.today { display: flex; flex-direction: column; align-items: flex-end; text-align: right; }
.today-count { font: 600 24px/1.1 var(--mono); color: var(--accent); }
.today-label { color: var(--muted); font-size: 12px; margin-top: 2px; }
.bar {
	width: 100%;
	height: 4px;
	margin-top: 12px;
	border-radius: 2px;
	background: var(--accent-soft);
}
.bar span { display: block; height: 100%; border-radius: 2px; background: var(--accent); }

.empty { padding: 48px 24px; text-align: center; border: 1px dashed var(--border); border-radius: 14px; }
.empty p { margin: 0; }
.muted { color: var(--muted); margin-top: 6px !important; }

footer {
	margin-top: 48px;
	display: flex;
	justify-content: space-between;
	gap: 16px;
	color: var(--muted);
	font-size: 13px;
}
footer a:hover { color: var(--accent); }

@media (max-width: 640px) {
	main { padding-top: 48px; }
	.repo { grid-template-columns: 1fr; gap: 14px; padding: 18px; position: relative; }
	.rank { position: absolute; top: 18px; right: 18px; font-size: 22px; }
	.title-row { padding-right: 36px; }
	.today { flex-direction: row; align-items: baseline; gap: 8px; flex-wrap: wrap; }
	.today-count { font-size: 18px; }
	.bar { flex-basis: 100%; margin-top: 4px; }
	footer { flex-direction: column; }
}
`;
