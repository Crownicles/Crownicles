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
});
