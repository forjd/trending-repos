const HEALTHCHECK_TIMEOUT_MS = 5_000;

// Pings a Healthchecks.io-style URL: the URL itself on success, `<url>/fail` on failure.
// A failed ping is only logged, so it can't fail the cron run on its own.
export async function pingHealthcheck(url: string | undefined, error?: string): Promise<void> {
	if (!url) return;
	const target = error === undefined ? url : `${url.replace(/\/+$/, "")}/fail`;
	try {
		const res = await fetch(target, {
			method: "POST",
			body: error?.slice(0, 10_000) ?? "",
			signal: AbortSignal.timeout(HEALTHCHECK_TIMEOUT_MS),
		});
		if (!res.ok) console.warn(`healthcheck: ${res.status}`);
	} catch (err) {
		console.warn("healthcheck:", err);
	}
}
