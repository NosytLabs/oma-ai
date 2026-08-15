const HOP_BY_HOP_HEADERS = new Set([
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
	"host",
]);

type CookieHeaders = Headers & {
	getSetCookie?: () => string[];
};

/**
	* Rebuild an upstream response without dropping cookies or hop-by-hop
	* headers. `Headers.get()` is not sufficient for Set-Cookie because a
	* response may contain more than one cookie; append each value separately.
	* The body remains a stream so SSE/chat responses are not buffered.
	*/
export function proxyResponse(upstream: Response): Response {
	const headers = new Headers();
	for (const [key, value] of upstream.headers.entries()) {
		const normalized = key.toLowerCase();
		if (
			HOP_BY_HOP_HEADERS.has(normalized) ||
			normalized === "set-cookie" ||
			// Node's fetch transparently decodes compressed upstream bodies;
			// never tell the browser to decode the stream a second time.
			normalized === "content-encoding" ||
			normalized === "content-length"
		) {
			continue;
		}
		headers.append(key, value);
	}

	const cookieHeaders = upstream.headers as CookieHeaders;
	const cookies = cookieHeaders.getSetCookie?.() ?? [];
	if (cookies.length > 0) {
		for (const cookie of cookies) headers.append("set-cookie", cookie);
	} else {
		// Older runtimes expose one cookie through get() but not getSetCookie().
		const cookie = upstream.headers.get("set-cookie");
		if (cookie) headers.append("set-cookie", cookie);
	}

	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers,
	});
}
