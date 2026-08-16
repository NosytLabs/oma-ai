import type { UsageRecord } from "./types";

export interface UsagePage {
	records: UsageRecord[];
	nextCursor: string | null;
}

/**
	* Walk cursor pages until exhausted or `maxRecords` is reached.
	* Pure helper so dashboard charts can load more than one API page.
	*/
export async function collectUsagePages(
	fetchPage: (cursor?: string) => Promise<UsagePage>,
	opts?: { maxRecords?: number; maxPages?: number },
): Promise<UsageRecord[]> {
	const maxRecords = opts?.maxRecords ?? 2000;
	const maxPages = opts?.maxPages ?? 20;
	const out: UsageRecord[] = [];
	let cursor: string | undefined;
	for (let i = 0; i < maxPages && out.length < maxRecords; i++) {
		const page = await fetchPage(cursor);
		const rows = page.records ?? [];
		out.push(...rows);
		if (!page.nextCursor || rows.length === 0) break;
		cursor = page.nextCursor;
	}
	return out.slice(0, maxRecords);
}
