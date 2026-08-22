import {
	type APIGatewaySessionStartLimit, RESTGetAPIGatewayBotResult, Routes
} from "discord-api-types/v10";
import {
	REST, type Shard
} from "discord.js";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { getShardSpawnRetryDelay } from "./ShardSpawnRetryUtils";

const REQUIRED_SESSIONS_PER_SHARD = 1;
const SHARD_RETRY_JITTER_MAX_MS = 5_000;

type ShardRetryReason = "Gateway session-start quota exhausted" | "bounded startup backoff";

interface ShardRetryPlan {
	delayMs: number;
	reason: ShardRetryReason;
}

type ShardRetryTimer = ReturnType<typeof setTimeout>;

export class ShardSpawnSupervisor {
	private readonly rest: REST;

	private readonly retryAttempts = new Map<number, number>();

	private readonly pendingRetries = new Set<number>();

	private readonly retryTimers = new Map<number, ShardRetryTimer>();

	private readonly ignoredDeaths = new Set<Shard>();

	public constructor(discordClientToken: string) {
		this.rest = new REST({ version: "10" }).setToken(discordClientToken);
	}

	public watch(shard: Shard): void {
		shard.on("ready", () => this.clearRetry(shard.id));
		shard.on("death", () => {
			if (this.ignoredDeaths.delete(shard)) {
				return;
			}

			CrowniclesLogger.error(`Shard ${shard.id} exited`);
			void this.scheduleRetry(shard);
		});
	}

	public killIntentionally(shard: Shard): boolean {
		this.clearRetry(shard.id);
		if (!shard.process && !shard.worker) {
			return true;
		}

		this.ignoredDeaths.add(shard);
		try {
			shard.kill();
			return true;
		}
		catch (error) {
			this.ignoredDeaths.delete(shard);
			CrowniclesLogger.errorWithObj(`Error while intentionally killing shard ${shard.id}`, error);
			return false;
		}
	}

	public cancelRetry(shardId: number): void {
		this.clearRetry(shardId);
	}

	public handleSpawnFailure(shard: Shard): void {
		if (shard.process || shard.worker) {
			try {
				shard.kill();
			}
			catch (error) {
				CrowniclesLogger.errorWithObj(`Error while cleaning up failed shard ${shard.id}`, error);
			}
		}

		if (!shard.process && !shard.worker) {
			void this.scheduleRetry(shard);
		}
	}

	private clearRetry(shardId: number): void {
		const retryTimer = this.retryTimers.get(shardId);
		if (retryTimer) {
			clearTimeout(retryTimer);
			this.retryTimers.delete(shardId);
		}

		this.pendingRetries.delete(shardId);
		this.retryAttempts.delete(shardId);
	}

	private async scheduleRetry(shard: Shard): Promise<void> {
		if (this.pendingRetries.has(shard.id) || this.retryTimers.has(shard.id)) {
			return;
		}

		const attempt = (this.retryAttempts.get(shard.id) ?? 0) + 1;
		this.retryAttempts.set(shard.id, attempt);
		this.pendingRetries.add(shard.id);

		try {
			const retryPlan = await this.getRetryPlan(attempt);
			if (this.retryAttempts.get(shard.id) !== attempt) {
				this.pendingRetries.delete(shard.id);
				return;
			}

			this.pendingRetries.delete(shard.id);
			const retryAt = new Date(Date.now() + retryPlan.delayMs).toISOString();
			CrowniclesLogger.warn(`Shard ${shard.id} retry scheduled at ${retryAt} (${retryPlan.reason}, attempt ${attempt})`);

			const retryTimer = setTimeout(() => {
				this.retryTimers.delete(shard.id);
				void shard.spawn().catch(error => {
					CrowniclesLogger.errorWithObj(`Error while respawning shard ${shard.id}`, error);
					this.handleSpawnFailure(shard);
				});
			}, retryPlan.delayMs);
			this.retryTimers.set(shard.id, retryTimer);
		}
		catch (error) {
			this.pendingRetries.delete(shard.id);
			CrowniclesLogger.errorWithObj(`Error while scheduling shard ${shard.id} retry`, error);
		}
	}

	private async getRetryPlan(attempt: number): Promise<ShardRetryPlan> {
		const sessionStartLimit = await this.getSessionStartLimit();
		const quotaExhausted = sessionStartLimit !== undefined
			&& sessionStartLimit.remaining < REQUIRED_SESSIONS_PER_SHARD;

		return {
			delayMs: getShardSpawnRetryDelay({
				attempt,
				requiredSessions: REQUIRED_SESSIONS_PER_SHARD,
				sessionStartLimit,
				jitterMs: this.getRetryJitterMs()
			}),
			reason: quotaExhausted
				? "Gateway session-start quota exhausted"
				: "bounded startup backoff"
		};
	}

	private async getSessionStartLimit(): Promise<APIGatewaySessionStartLimit | undefined> {
		try {
			const gatewayInfo = await this.rest.get(Routes.gatewayBot()) as RESTGetAPIGatewayBotResult;
			return gatewayInfo.session_start_limit;
		}
		catch (error) {
			CrowniclesLogger.errorWithObj("Unable to fetch Discord Gateway session limit", error);
			return undefined;
		}
	}

	private getRetryJitterMs(): number {
		return Math.floor(Math.random() * (SHARD_RETRY_JITTER_MAX_MS + 1));
	}
}
