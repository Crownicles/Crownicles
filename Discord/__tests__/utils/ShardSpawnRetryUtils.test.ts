import {describe, expect, it} from "vitest";
import {getShardSpawnRetryDelay} from "../../src/utils/ShardSpawnRetryUtils";

describe("getShardSpawnRetryDelay", () => {
	it("waits for the Gateway session reset when the quota is exhausted", () => {
		expect(getShardSpawnRetryDelay({
			attempt: 1,
			requiredSessions: 1,
			sessionStartLimit: {
				total: 1_000,
				remaining: 0,
				reset_after: 120_000,
				max_concurrency: 1
			},
			jitterMs: 1_500
		})).toBe(121_500);
	});

	it("uses exponential backoff while sessions remain available", () => {
		expect(getShardSpawnRetryDelay({
			attempt: 1,
			requiredSessions: 1,
			sessionStartLimit: {
				total: 1_000,
				remaining: 10,
				reset_after: 120_000,
				max_concurrency: 1
			},
			jitterMs: 0
		})).toBe(5_000);
		expect(getShardSpawnRetryDelay({
			attempt: 3,
			requiredSessions: 1,
			sessionStartLimit: undefined,
			jitterMs: 250
		})).toBe(20_250);
	});

	it("caps exponential backoff", () => {
		expect(getShardSpawnRetryDelay({
			attempt: 20,
			requiredSessions: 1,
			sessionStartLimit: undefined,
			jitterMs: 500
		})).toBe(300_500);
	});
});