declare namespace Cloudflare {
	interface Env {
		TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
	}
}

declare module "*.html?raw" {
	const html: string;
	export default html;
}
