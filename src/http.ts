// Cloudflare turns the ETag into a weak one (W/"...") when it compresses the response,
// and browsers send that back, so compare without the W/ prefix
export function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
	if (!ifNoneMatch) return false;
	return ifNoneMatch.split(",").some((tag) => {
		const t = tag.trim();
		return t === "*" || t.replace(/^W\//, "") === etag;
	});
}

export async function authorized(request: Request, key: string | undefined): Promise<boolean> {
	if (!key) return false;
	const given = request.headers.get("authorization") ?? "";
	// Hash both so the lengths match, then compare in constant time
	const [a, b] = await Promise.all(
		[given, `Bearer ${key}`].map((s) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))),
	);
	return crypto.subtle.timingSafeEqual(a, b);
}
