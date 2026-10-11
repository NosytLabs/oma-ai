/**
	* Better Auth–compatible identity union. `userId` is always set when
	* authenticated. `authMethod` is `session` for cookie-based auth,
	* `apiKey` for `Authorization: Bearer oma_sk_…` requests. Routes that
	* need to distinguish can read both.
	*/
import type { ApiKey } from "./db/schema.js";

type AuthMethod = "session" | "apiKey";

export type OmaEnv = {
		Variables: {
				userId: string;
				authMethod?: AuthMethod;
				rateLimit?: { remaining: number; reset: number };
				apiKey: ApiKey | null;
				correlationId?: string;
				inferenceRequestId?: string;
				inferenceOutcome?: "completed" | "error" | "aborted";
				payment?: { txHash?: string; amount: string; networkId: string };
				teamRole?: string;
				// Set by route handlers when using the audit middleware factories
				// (createAuditLogger / auditWriteOp) so the post-response hook can
				// capture the actual mutation outcome. resourceId is a string,
				// metadata is a JSON-serializable object.
				resourceId?: string;
				auditMetadata?: Record<string, unknown>;
				// Set by the Better Auth session middleware. `user` is the canonical
				// session payload; route handlers can read it directly.
				session?: {
						id: string;
						userId: string;
						expiresAt: Date;
						token: string;
						ipAddress?: string | null;
						userAgent?: string | null;
						createdAt: Date;
						updatedAt: Date;
				};
				user?: {
						id: string;
						email: string;
						name: string;
						emailVerified: boolean;
						image?: string | null;
						evmAddress?: string | null;
						isAnonymous?: boolean | null;
						createdAt: Date;
						updatedAt: Date;
				};
		};
};
