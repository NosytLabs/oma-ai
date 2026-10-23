import { DrizzleQueryError } from "drizzle-orm/errors";

type ErrorRecord = { cause?: unknown; name?: unknown; code?: unknown; status?: unknown };

function errorChain(error: unknown): ErrorRecord[] {
	const chain: ErrorRecord[] = [];
	const seen = new Set<object>();
	while (error && typeof error === "object" && !seen.has(error) && chain.length < 16) {
		seen.add(error);
		const record = error as ErrorRecord;
		chain.push(record);
		error = record.cause;
	}
	return chain;
}

export function isDatabaseError(error: unknown): boolean {
	return errorChain(error).some(record => record instanceof DrizzleQueryError ||
		(typeof record.name === "string" && ["DatabaseError", "NeonDbError", "PostgresError"].includes(record.name)) ||
		(typeof record.code === "string" && /^[0-9A-Z]{5}$/.test(record.code)));
}

/** SQL, parameters, driver clients and free-form messages can contain secrets. */
export function databaseErrorMetadata(error: unknown) {
	const metadata: { type: string; code?: string; status?: number } = { type: "DatabaseError" };
	for (const { code, status } of errorChain(error)) {
		if (metadata.code === undefined && typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) metadata.code = code;
		if (metadata.status === undefined && typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599) {
			metadata.status = status;
		}
	}
	return metadata;
}
