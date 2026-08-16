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
		},
		ENCHANTER_CITY: {
			getValue: vi.fn().mockResolvedValue("capital"),
			setValue: vi.fn().mockResolvedValue(undefined)
		},
		ENCHANTER_ENCHANTMENT_ID: {
			getValue: vi.fn().mockResolvedValue("pvpAttack1"),
			setValue: vi.fn().mockResolvedValue(undefined)
		},
		NEXT_ENCHANTER_CITY: {
			getValue: vi.fn().mockResolvedValue("ville_forte"),
			setValue: vi.fn().mockResolvedValue(undefined)
		},
		NEXT_ENCHANTER_ENCHANTMENT_ID: {
			getValue: vi.fn().mockResolvedValue("defense1"),
			setValue: vi.fn().mockResolvedValue(undefined)
		}
	}
}));

vi.mock("../../../../src/data/City", () => ({
	CityDataController: {
		instance: {
			getRandomCity: vi.fn().mockReturnValue({ id: "coco_village" })
		}
	}
}));

vi.mock("../../../../../Lib/src/types/ItemEnchantment", () => ({
	ItemEnchantment: {
		getRandomEnchantment: vi.fn().mockReturnValue({ id: "speed1" })
	}
}));

vi.mock("../../../../src/core/database/game/models/Player", () => ({
	default: { update: vi.fn().mockResolvedValue([0]) }
}));

vi.mock("../../../../src/core/database/game/models/PetEntity", () => ({
	default: { update: vi.fn().mockResolvedValue([0]) }
}));

vi.mock("../../../../src/core/database/game/models/Guild", () => ({
	default: { sequelize: { query: vi.fn().mockResolvedValue([undefined, 0]) } }
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
import PetEntity from "../../../../src/core/database/game/models/PetEntity";
import Guild from "../../../../src/core/database/game/models/Guild";
import Player from "../../../../src/core/database/game/models/Player";
import { PetConstants } from "../../../../../Lib/src/constants/PetConstants";
import { GuildDomainConstants } from "../../../../../Lib/src/constants/GuildDomainConstants";
import { TokensConstants } from "../../../../../Lib/src/constants/TokensConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { Settings } from "../../../../src/core/database/game/models/Setting";
import { CityDataController } from "../../../../src/data/City";
import { ItemEnchantment } from "../../../../../Lib/src/types/ItemEnchantment";

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

	it("never cuts down players that are above the token cap", async () => {
		vi.spyOn(CrowniclesDaily, "randomPotion").mockResolvedValue();
		vi.spyOn(CrowniclesDaily, "randomLovePointsLoose").mockResolvedValue(false);
		vi.spyOn(CrowniclesDaily, "reloadEnchanter").mockResolvedValue();
		vi.spyOn(CrowniclesDaily, "trainingGroundLoveBonus").mockResolvedValue();
		vi.spyOn(CrowniclesDaily, "pantryAutoFill").mockResolvedValue();
		vi.mocked(Player.update).mockClear();

		await CrowniclesDaily.job();

		expect(Player.update).toHaveBeenCalledWith(
			{
				tokens: expect.objectContaining({
					val: TokensConstants.buildRefillExpression(TokensConstants.DAILY.FREE_PER_DAY)
				})
			},
			{ where: {} }
		);
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

/**
 * Sequelize `literal()` hides its SQL in an opaque wrapper; unwrap it for assertions.
 */
function literalSql(value: unknown): string {
	return (value as { val: string }).val;
}

describe("CrowniclesDaily.randomLovePointsLoose", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.mocked(PetEntity.update)
			.mockReset()
			.mockResolvedValue([0]);
	});

	it("removes the balancing constant, not a hardcoded amount", async () => {
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(true);

		await expect(CrowniclesDaily.randomLovePointsLoose()).resolves.toBe(true);

		const [values] = vi.mocked(PetEntity.update).mock.calls[0];
		expect(literalSql(values.lovePoints)).toBe(`GREATEST(0, lovePoints - ${PetConstants.DAILY_LOVE_LOSS})`);
	});

	it("leaves every pet untouched when the daily draw says so", async () => {
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);

		await expect(CrowniclesDaily.randomLovePointsLoose()).resolves.toBe(false);

		expect(PetEntity.update).not.toHaveBeenCalled();
	});
});

describe("CrowniclesDaily.reloadEnchanter", () => {
	beforeEach(() => {
		vi.mocked(Settings.ENCHANTER_CITY.setValue).mockClear();
		vi.mocked(Settings.ENCHANTER_ENCHANTMENT_ID.setValue).mockClear();
		vi.mocked(Settings.NEXT_ENCHANTER_CITY.setValue).mockClear();
		vi.mocked(Settings.NEXT_ENCHANTER_ENCHANTMENT_ID.setValue).mockClear();
		vi.mocked(CityDataController.instance.getRandomCity).mockClear();
		vi.mocked(ItemEnchantment.getRandomEnchantment).mockClear();
	});

	it("promotes tomorrow's choice and prepares the following day", async () => {
		await CrowniclesDaily.reloadEnchanter();

		expect(Settings.ENCHANTER_ENCHANTMENT_ID.setValue).toHaveBeenCalledWith("defense1");
		expect(Settings.ENCHANTER_CITY.setValue).toHaveBeenCalledWith("ville_forte");
		expect(Settings.NEXT_ENCHANTER_ENCHANTMENT_ID.setValue).toHaveBeenCalledWith("speed1");
		expect(Settings.NEXT_ENCHANTER_CITY.setValue).toHaveBeenCalledWith("coco_village");
	});
});

describe("CrowniclesDaily.trainingGroundLoveBonus", () => {
	beforeEach(() => {
		vi.mocked(Guild.sequelize!.query)
			.mockReset()
			.mockResolvedValue([undefined, 0]);
	});

	// The love amount comes from the balancing table, never from the building level itself
	it("gives each training ground level its balancing love value", async () => {
		await CrowniclesDaily.trainingGroundLoveBonus();

		const [sql] = vi.mocked(Guild.sequelize!.query).mock.calls[0];
		GuildDomainConstants.TRAINING_LOVE_PER_DAY.forEach((lovePerDay, level) => {
			if (lovePerDay > 0) {
				expect(sql).toContain(`WHEN ${level} THEN ${lovePerDay}`);
			}
		});
	});
});
