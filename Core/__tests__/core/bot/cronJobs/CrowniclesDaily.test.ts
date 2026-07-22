import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: {
		warn: vi.fn(),
		info: vi.fn(),
		error: vi.fn(),
		errorWithObj: vi.fn(),
		init: vi.fn(),
		get: vi.fn()
	}
}));

vi.mock("../../../../src/core/database/game/models/Setting", () => ({
	Settings: {
		NEXT_DAILY_RESET: {
			getValue: vi.fn().mockResolvedValue(0),
			setValue: vi.fn().mockResolvedValue(undefined)
		}
	}
}));

vi.mock("../../../../src/core/database/game/models/Player", () => ({
	default: { update: vi.fn().mockResolvedValue([0]) }
}));

vi.mock("../../../../src/app", () => ({
	crowniclesInstance: {
		logsDatabase: {
			logDailyTimeout: vi.fn().mockResolvedValue(undefined),
			log15BestTopWeek: vi.fn().mockResolvedValue(undefined)
		}
	}
}));

vi.mock("../../../../src/core/bot/CrowniclesCoreMetrics", () => ({
	CrowniclesCoreMetrics: { incrementDailyTaskFailure: vi.fn() }
}));

import { CrowniclesDaily } from "../../../../src/core/bot/cronJobs/CrowniclesDaily";
import { CrowniclesCoreMetrics } from "../../../../src/core/bot/CrowniclesCoreMetrics";

type Gate<T> = {
	promise: Promise<T>;
	resolve: (value: T) => void;
};

/**
 * Create a manually controllable promise so a test can decide precisely when a
 * mocked task resolves, and thus observe the scheduling between tasks.
 */
function createGate<T = void>(): Gate<T> {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(res => {
		resolve = res;
	});
	return {
		promise,
		resolve
	};
}

/**
 * Let all currently pending microtasks (and a macrotask boundary) run.
 */
function flushAsync(): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, 0));
}

describe("CrowniclesDaily.job", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.mocked(CrowniclesCoreMetrics.incrementDailyTaskFailure).mockReset();
	});

	it("keeps running the other daily tasks when one of them fails", async () => {
		vi.spyOn(CrowniclesDaily, "randomPotion").mockResolvedValue();
		vi.spyOn(CrowniclesDaily, "randomLovePointsLoose").mockResolvedValue(false);
		const reloadEnchanter = vi.spyOn(CrowniclesDaily, "reloadEnchanter")
			.mockRejectedValue(new Error("DB connection timeout"));
		const trainingGroundLoveBonus = vi.spyOn(CrowniclesDaily, "trainingGroundLoveBonus")
			.mockResolvedValue();
		const pantryAutoFill = vi.spyOn(CrowniclesDaily, "pantryAutoFill")
			.mockResolvedValue();

		await CrowniclesDaily.job();

		// The failing task ran...
		expect(reloadEnchanter).toHaveBeenCalledTimes(1);

		// ...but did not prevent the following tasks from running
		expect(trainingGroundLoveBonus).toHaveBeenCalledTimes(1);
		expect(pantryAutoFill).toHaveBeenCalledTimes(1);

		// ...and the failure was surfaced through the metric
		expect(CrowniclesCoreMetrics.incrementDailyTaskFailure).toHaveBeenCalledWith("reloadEnchanter");
	});

	it("runs the daily tasks strictly one after another, never concurrently", async () => {
		const started: string[] = [];

		const potionGate = createGate();
		const loveGate = createGate<boolean>();
		const enchanterGate = createGate();
		const trainingGate = createGate();

		vi.spyOn(CrowniclesDaily, "randomPotion").mockImplementation(() => {
			started.push("randomPotion");
			return potionGate.promise;
		});
		vi.spyOn(CrowniclesDaily, "randomLovePointsLoose").mockImplementation(() => {
			started.push("randomLovePointsLoose");
			return loveGate.promise;
		});
		vi.spyOn(CrowniclesDaily, "reloadEnchanter").mockImplementation(() => {
			started.push("reloadEnchanter");
			return enchanterGate.promise;
		});
		vi.spyOn(CrowniclesDaily, "trainingGroundLoveBonus").mockImplementation(() => {
			started.push("trainingGroundLoveBonus");
			return trainingGate.promise;
		});
		vi.spyOn(CrowniclesDaily, "pantryAutoFill").mockResolvedValue();

		const jobPromise = CrowniclesDaily.job();

		// Only the first task has started while its gate is still pending.
		await flushAsync();
		expect(started).toEqual(["randomPotion"]);

		// Resolving a task lets exactly the next one start, and no earlier.
		potionGate.resolve();
		await flushAsync();
		expect(started).toEqual(["randomPotion", "randomLovePointsLoose"]);

		loveGate.resolve(false);
		await flushAsync();
		expect(started).toEqual(["randomPotion", "randomLovePointsLoose", "reloadEnchanter"]);

		enchanterGate.resolve();
		await flushAsync();
		expect(started).toEqual([
			"randomPotion",
			"randomLovePointsLoose",
			"reloadEnchanter",
			"trainingGroundLoveBonus"
		]);

		trainingGate.resolve();
		await jobPromise;
	});
});
