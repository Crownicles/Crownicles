import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";

const {
	loggerError, loggerErrorWithObj, loggerWarn, restGet
} = vi.hoisted(() => ({
	loggerError: vi.fn(),
	loggerErrorWithObj: vi.fn(),
	loggerWarn: vi.fn(),
	restGet: vi.fn()
}));

vi.mock("discord.js", () => ({
	REST: class {
		public setToken(): this {
			return this;
		}

		public get(...args: unknown[]): Promise<unknown> {
			return restGet(...args);
		}
	}
}));

vi.mock("../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: {
		error: loggerError,
		errorWithObj: loggerErrorWithObj,
		warn: loggerWarn
	}
}));

import type { Shard } from "discord.js";
import { ShardSpawnSupervisor } from "../../src/utils/ShardSpawnSupervisor";

interface FakeShardOptions {
	process?: { pid: number } | null;
	worker?: { threadId: number } | null;
}

function createShard({
	process = null,
	worker = null
}: FakeShardOptions = {}): Shard {
	return {
		id: 0,
		process,
		worker,
		kill: vi.fn(),
		spawn: vi.fn(),
		on: vi.fn().mockReturnThis()
	} as unknown as Shard;
}

function getAvailableSessionLimit(): object {
	return {
		session_start_limit: {
			total: 1_000,
			remaining: 10,
			reset_after: 120_000,
			max_concurrency: 1
		}
	};
}

describe("ShardSpawnSupervisor", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.spyOn(Math, "random").mockReturnValue(0);
		restGet.mockReset();
		loggerError.mockReset();
		loggerErrorWithObj.mockReset();
		loggerWarn.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("does not try to kill an already dead shard", () => {
		const shard = createShard();
		const supervisor = new ShardSpawnSupervisor("token");

		expect(supervisor.killIntentionally(shard)).toBe(true);
		expect(shard.kill).not.toHaveBeenCalled();
	});

	it("cleans up a live shard without querying the Gateway", () => {
		const shard = createShard({ process: { pid: 123 } });
		const supervisor = new ShardSpawnSupervisor("token");

		expect(supervisor.killIntentionally(shard)).toBe(true);
		expect(shard.kill).toHaveBeenCalledOnce();
		expect(restGet).not.toHaveBeenCalled();
	});

	it("retries a failed spawn after bounded backoff", async () => {
		restGet.mockResolvedValue(getAvailableSessionLimit());
		const shard = createShard();
		shard.spawn = vi.fn().mockResolvedValue({});
		const supervisor = new ShardSpawnSupervisor("token");

		supervisor.handleSpawnFailure(shard);
		await vi.advanceTimersByTimeAsync(0);
		expect(restGet).toHaveBeenCalledOnce();
		expect(shard.spawn).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(5_000);
		expect(shard.spawn).toHaveBeenCalledOnce();
	});

	it("waits for the Gateway reset before retrying an exhausted quota", async () => {
		restGet.mockResolvedValue({
			session_start_limit: {
				total: 1_000,
				remaining: 0,
				reset_after: 60_000,
				max_concurrency: 1
			}
		});
		const shard = createShard();
		shard.spawn = vi.fn().mockResolvedValue({});
		const supervisor = new ShardSpawnSupervisor("token");

		supervisor.handleSpawnFailure(shard);
		await vi.advanceTimersByTimeAsync(0);
		await vi.advanceTimersByTimeAsync(59_999);
		expect(shard.spawn).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		expect(shard.spawn).toHaveBeenCalledOnce();
	});

	it("cancels a pending retry when a shard is replaced", async () => {
		restGet.mockResolvedValue(getAvailableSessionLimit());
		const shard = createShard();
		shard.spawn = vi.fn().mockResolvedValue({});
		const supervisor = new ShardSpawnSupervisor("token");

		supervisor.handleSpawnFailure(shard);
		await vi.advanceTimersByTimeAsync(0);
		supervisor.cancelRetry(shard.id);
		await vi.advanceTimersByTimeAsync(5_000);

		expect(shard.spawn).not.toHaveBeenCalled();
	});

	it("kills a still-running process after a spawn timeout", () => {
		const shard = createShard({ process: { pid: 123 } });
		const supervisor = new ShardSpawnSupervisor("token");

		supervisor.handleSpawnFailure(shard);

		expect(shard.kill).toHaveBeenCalledOnce();
		expect(restGet).not.toHaveBeenCalled();
	});
});
