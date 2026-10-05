import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		cloudflareTest(async () => ({
			main: "./src/index.ts",
			wrangler: { configPath: "./wrangler.jsonc" },
			miniflare: {
				bindings: {
					REFRESH_KEY: "test-key",
					GITHUB_TOKEN: "",
					TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, "migrations")),
				},
			},
		})),
	],
	test: { setupFiles: ["./test/setup.ts"] },
});
