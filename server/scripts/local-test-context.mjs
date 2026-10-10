/** Never let test tooling mutate a remote database or a production environment. */
export function localTestContext() {
	if (["production", "staging", "preview"].includes(process.env.NODE_ENV)) {
		throw new Error("Local test tools are disabled outside development/test.");
	}
	const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
	const appOrigin = process.env.TEST_APP_ORIGIN ?? process.env.PUBLIC_APP_URL ?? "http://localhost:3000";
	const databaseUrl = new URL(process.env.DATABASE_URL ?? "invalid:");
	if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol) || !localHosts.has(databaseUrl.hostname) || !localHosts.has(new URL(appOrigin).hostname)) {
		throw new Error("Local test tools require a loopback database and app origin.");
	}
	return { databaseUrl, appOrigin };
}
