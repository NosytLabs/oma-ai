import { describe, expect, it } from "vitest";
import {
	REDIS_CONNECTION_STATE,
	parseRedisConnectionState,
} from "../redis-connection-state.js";

describe("parseRedisConnectionState", () => {
	it("maps the statuses the client writes", () => {
		expect(parseRedisConnectionState("ok")).toBe(REDIS_CONNECTION_STATE.Ready);
		expect(parseRedisConnectionState("error")).toBe(REDIS_CONNECTION_STATE.Error);
		expect(parseRedisConnectionState("disconnected")).toBe(
			REDIS_CONNECTION_STATE.Disconnected,
		);
	});

	it("never degrades an unknown status into ready", () => {
		expect(parseRedisConnectionState("auth_failed")).toBe(
			REDIS_CONNECTION_STATE.Disconnected,
		);
		expect(parseRedisConnectionState("")).toBe(
			REDIS_CONNECTION_STATE.Disconnected,
		);
		expect(parseRedisConnectionState(undefined)).toBe(
			REDIS_CONNECTION_STATE.Disconnected,
		);
		expect(parseRedisConnectionState(null)).toBe(
			REDIS_CONNECTION_STATE.Disconnected,
		);
	});
});
