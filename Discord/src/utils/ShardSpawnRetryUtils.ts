import type { APIGatewaySessionStartLimit } from "discord-api-types/v10";

const SHARD_SPAWN_RETRY_INITIAL_DELAY_MS = 5_000;
const SHARD_SPAWN_RETRY_MAX_DELAY_MS = 5 * 60 * 1_000;

export interface ShardSpawnRetryOptions {
	attempt: number;
	requiredSessions: number;
	sessionStartLimit?: APIGatewaySessionStartLimit;
	jitterMs: number;
}

export function getShardSpawnRetryDelay({
	attempt,
	requiredSessions,
	sessionStartLimit,
	jitterMs
}: ShardSpawnRetryOptions): number {
	const safeAttempt = Math.max(1, Math.floor(attempt));
	const safeJitterMs = Math.max(0, jitterMs);

	if (sessionStartLimit && sessionStartLimit.remaining < requiredSessions) {
		return Math.max(0, sessionStartLimit.reset_after) + safeJitterMs;
	}

	const exponentialDelay = SHARD_SPAWN_RETRY_INITIAL_DELAY_MS * 2 ** (safeAttempt - 1);
	return Math.min(exponentialDelay, SHARD_SPAWN_RETRY_MAX_DELAY_MS) + safeJitterMs;
}
