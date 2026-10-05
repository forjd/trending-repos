import { vi } from "vitest";
import trendingHtml from "./fixtures/trending.html?raw";

export { trendingHtml };

export interface ApiRepo {
	id: number;
	stargazers_count?: number;
	topics?: string[];
}

// Stubs fetch: the trending page returns `html`, API lookups return `api(owner/name)`
export function mockGitHub(
	html: string,
	api: (fullName: string) => Response = (fullName) => Response.json(apiRepo({ id: fakeId(fullName) })),
) {
	return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		if (url.hostname === "github.com" && url.pathname === "/trending") return new Response(html);
		if (url.hostname === "api.github.com") return api(url.pathname.replace(/^\/repos\//, ""));
		throw new Error(`unexpected fetch ${url}`);
	});
}

export function apiRepo(fields: ApiRepo) {
	return {
		stargazers_count: 100,
		forks_count: 10,
		topics: ["cli"],
		homepage: null,
		owner: { avatar_url: "https://avatars.githubusercontent.com/u/1" },
		...fields,
	};
}

export function fakeId(fullName: string): number {
	let h = 0;
	for (const c of fullName.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) | 0;
	return Math.abs(h);
}

// One trending row in GitHub's markup
export function row(path: string, opts: { stars?: string; today?: string; desc?: string; extra?: string } = {}) {
	return `<article class="Box-row">
		<h2 class="h3 lh-condensed"><a href="${path}" class="Link">${path}</a></h2>
		<p class="col-9 color-fg-muted my-1 pr-4">
			${opts.desc ?? "A description"}
		</p>
		<div class="f6 color-fg-muted mt-2">
			<span itemprop="programmingLanguage">Go</span>
			<a href="${path}/stargazers" class="Link">${opts.stars ?? "1,234"}</a>
			<a href="${path}/forks" class="Link">56</a>
			${opts.extra ?? ""}
			<span class="d-inline-block float-sm-right">${opts.today ?? "100"} stars today</span>
		</div>
	</article>`;
}

export function page(...rows: string[]) {
	return `<html><body>${rows.join("\n")}</body></html>`;
}
