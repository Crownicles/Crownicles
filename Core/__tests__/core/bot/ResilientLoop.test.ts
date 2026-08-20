import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import { asMilliseconds } from "../../../../Lib/src/types/TimeTypes";

vi.mock("../../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: {
		error: vi.fn(),
		errorWithObj: vi.fn()
	}
}));

vi.mock("../../../src/core/bot/CrowniclesCoreMetrics", () => ({
	CrowniclesCoreMetrics: { observeLoopRun: vi.fn() }
}));

const {
	PERIODIC_LOOPS, startResilientLoop
} = await import("../../../src/core/bot/ResilientLoop");
const { CrowniclesCoreMetrics } = await import("../../../src/core/bot/CrowniclesCoreMetrics");
const { CrowniclesLogger } = await import("../../../../Lib/src/logs/CrowniclesLogger");

const DELAY = asMilliseconds(1000);

describe("startResilientLoop", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("keeps running after an iteration rejects", async () => {
		const iteration = vi.fn()
			.mockRejectedValueOnce(new Error("database unavailable"))
			.mockResolvedValue(undefined);

		startResilientLoop(PERIODIC_LOOPS.ENERGY_REGEN, iteration, DELAY, { startImmediately: true });

		await vi.advanceTimersByTimeAsync(0);
		expect(iteration).toHaveBeenCalledTimes(1);
		expect(CrowniclesLogger.errorWithObj).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(DELAY);
		expect(iteration).toHaveBeenCalledTimes(2);

		await vi.advanceTimersByTimeAsync(DELAY);
		expect(iteration).toHaveBeenCalledTimes(3);
	});

	it("does not record a heartbeat for a failed iteration but records one for the next success", async () => {
		const iteration = vi.fn()
			.mockRejectedValueOnce(new Error("database unavailable"))
			.mockResolvedValue(undefined);

		startResilientLoop(PERIODIC_LOOPS.REPORT_NOTIFICATIONS, iteration, DELAY, { startImmediately: true });

		await vi.advanceTimersByTimeAsync(0);
		expect(CrowniclesCoreMetrics.observeLoopRun).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(DELAY);
		expect(CrowniclesCoreMetrics.observeLoopRun).toHaveBeenCalledWith(PERIODIC_LOOPS.REPORT_NOTIFICATIONS);
	});

	it("waits for a full delay before the first iteration when asked to", async () => {
		const iteration = vi.fn()
			.mockResolvedValue(undefined);

		startResilientLoop(PERIODIC_LOOPS.ENERGY_REGEN, iteration, DELAY, { startImmediately: false });

		await vi.advanceTimersByTimeAsync(DELAY - 1);
		expect(iteration).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		expect(iteration).toHaveBeenCalledTimes(1);
	});
});
