import {
	describe, it, expect, vi, beforeEach, afterEach
} from "vitest";
import { BlessingManager } from "../../../src/core/blessings/BlessingManager";
import {
	BlessingConstants, BlessingType
} from "../../../../Lib/src/constants/BlessingConstants";
import { GlobalBlessings } from "../../../src/core/database/game/models/GlobalBlessing";
import { PacketUtils } from "../../../src/core/utils/PacketUtils";
import { crowniclesInstance } from "../../../src/app";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { PlayerMissionsInfo } from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { Players } from "../../../src/core/database/game/models/Player";
import { BlessingAnnouncementPacket } from "../../../../Lib/src/packets/announcements/BlessingAnnouncementPacket";
import { DailyMissions } from "../../../src/core/database/game/models/DailyMission";
import { Op } from "sequelize";

// Mock dependencies
vi.mock("../../../src/core/database/game/models/GlobalBlessing", () => ({
	GlobalBlessings: { get: vi.fn() },
	GlobalBlessing: class {}
}));

vi.mock("../../../src/core/utils/PacketUtils", () => ({
	PacketUtils: { announce: vi.fn() }
}));

vi.mock("../../../../Lib/src/utils/MqttTopicUtils", () => ({
	MqttTopicUtils: { getDiscordBlessingAnnouncementTopic: vi.fn().mockReturnValue("test/topic") },
	createMqttPrefix: vi.fn().mockImplementation((prefix: string) => prefix)
}));

vi.mock("../../../src/app", () => ({
	botConfig: { PREFIX: "test" as string & { readonly __brand: "MqttPrefix" } },
	crowniclesInstance: {
		logsDatabase: {
			logBlessingContribution: vi.fn().mockResolvedValue(undefined),
			logBlessingActivation: vi.fn().mockResolvedValue(undefined),
			logBlessingExpiration: vi.fn().mockResolvedValue(undefined),
			logBlessingPoolExpiration: vi.fn().mockResolvedValue(undefined),
			getContributionsSince: vi.fn().mockResolvedValue(new Map())
		}
	}
}));

vi.mock("../../../../Lib/src/utils/RandomUtils", () => ({
	RandomUtils: { randInt: vi.fn().mockReturnValue(3) }
}));

vi.mock("../../../src/core/database/game/models/PlayerMissionsInfo", () => ({
	PlayerMissionsInfo: { findAll: vi.fn().mockResolvedValue([]) }
}));

vi.mock("../../../src/core/database/game/models/DailyMission", () => ({
	DailyMissions: {
		getOrGenerate: vi.fn().mockResolvedValue({
			gemsToWin: 5,
			xpToWin: 100,
			moneyToWin: 50,
			pointsToWin: 30
		})
	}
}));

vi.mock("../../../src/core/database/game/models/Player", () => ({
	Players: { getById: vi.fn() }
}));

vi.mock("../../../../Lib/src/constants/Constants", () => ({
	Constants: { MISSIONS: { DAILY_MISSION_MONEY_MULTIPLIER: 2, DAILY_MISSION_POINTS_MULTIPLIER: 2 } }
}));

vi.mock("../../../../Lib/src/constants/LogsConstants", () => ({
	NumberChangeReason: { BLESSING: "blessing" }
}));

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const NOW = new Date(2026, 2, 10, 10, 0, 0);

/**
 * Create a mock GlobalBlessing object
 */
function createMockBlessing(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: 1,
		poolAmount: 0,
		poolThreshold: BlessingConstants.INITIAL_POOL_THRESHOLD,
		poolStartedAt: new Date(),
		activeBlessingType: BlessingType.NONE,
		blessingEndAt: null,
		lastTriggeredByKeycloakId: null,
		lastBlessingTriggeredAt: null,
		save: vi.fn().mockResolvedValue(undefined),
		...overrides
	};
}

/**
 * Create a BlessingManager with an injected mock blessing via private field access
 */
function createManager(mockBlessing: Record<string, unknown> | null = null): BlessingManager {
	// Reset the singleton so we get a fresh instance
	(BlessingManager as unknown as { instance: BlessingManager | null }).instance = null;
	const manager = BlessingManager.getInstance();
	// Inject the mock blessing directly into the private field
	(manager as unknown as { cachedBlessing: unknown }).cachedBlessing = mockBlessing;
	return manager;
}

describe("BlessingManager", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("isActive", () => {
		it("should return false when no blessing is cached", () => {
			const manager = createManager(null);

			expect(manager.isActive(BlessingType.MONEY_BOOST)).toBe(false);
		});

		it("should return false when blessing type does not match", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.FIGHT_LOOT,
				blessingEndAt: new Date(Date.now() + 3600000)
			}));

			expect(manager.isActive(BlessingType.MONEY_BOOST)).toBe(false);
		});

		it("should return false when blessing has expired", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.MONEY_BOOST,
				blessingEndAt: new Date(Date.now() - 3600000) // 1h ago
			}));

			expect(manager.isActive(BlessingType.MONEY_BOOST)).toBe(false);
		});

		it("should return true when blessing type matches and is not expired", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.MONEY_BOOST,
				blessingEndAt: new Date(Date.now() + 3600000) // 1h from now
			}));

			expect(manager.isActive(BlessingType.MONEY_BOOST)).toBe(true);
		});
	});

	describe("hasActiveBlessing", () => {
		it("should return false when type is NONE", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.NONE
			}));

			expect(manager.hasActiveBlessing()).toBe(false);
		});

		it("should return false when blessingEndAt is null", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.FIGHT_LOOT,
				blessingEndAt: null
			}));

			expect(manager.hasActiveBlessing()).toBe(false);
		});

		it("should return true when a blessing is active and not expired", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.ENERGY_REGEN,
				blessingEndAt: new Date(Date.now() + 3600000)
			}));

			expect(manager.hasActiveBlessing()).toBe(true);
		});
	});

	describe("getActiveBlessingType", () => {
		it("should return NONE when no blessing is active", () => {
			const manager = createManager(createMockBlessing());

			expect(manager.getActiveBlessingType()).toBe(BlessingType.NONE);
		});

		it("should return the active blessing type", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.SCORE_BOOST,
				blessingEndAt: new Date(Date.now() + 3600000)
			}));

			expect(manager.getActiveBlessingType()).toBe(BlessingType.SCORE_BOOST);
		});
	});

	describe("multiplier getters", () => {
		it("should return 1 for all multipliers when no blessing is active", () => {
			const manager = createManager(createMockBlessing());

			expect(manager.getMoneyMultiplier()).toBe(1);
			expect(manager.getScoreMultiplier()).toBe(1);
			expect(manager.getFightLootMultiplier()).toBe(1);
			expect(manager.getEnergyRegenMultiplier()).toBe(1);
			expect(manager.getPetLoveMultiplier()).toBe(1);
			expect(manager.getDailyMissionMultiplier()).toBe(1);
			expect(manager.getHealthPotionMultiplier()).toBe(1);
			expect(manager.isRageAmplified()).toBe(false);
			expect(manager.hasExpeditionTokenBonus()).toBe(false);
		});

		it("should return correct money multiplier when MONEY_BOOST is active", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.MONEY_BOOST,
				blessingEndAt: new Date(Date.now() + 3600000)
			}));

			expect(manager.getMoneyMultiplier()).toBe(1 + BlessingConstants.MONEY_BOOST_PERCENTAGE);
		});

		it("should return correct score multiplier when SCORE_BOOST is active", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.SCORE_BOOST,
				blessingEndAt: new Date(Date.now() + 3600000)
			}));

			expect(manager.getScoreMultiplier()).toBe(1 + BlessingConstants.SCORE_BOOST_PERCENTAGE);
		});

		it("should return correct fight loot multiplier when FIGHT_LOOT is active", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.FIGHT_LOOT,
				blessingEndAt: new Date(Date.now() + 3600000)
			}));

			expect(manager.getFightLootMultiplier()).toBe(BlessingConstants.FIGHT_LOOT_MULTIPLIER);
		});

		it("should return correct energy regen multiplier when ENERGY_REGEN is active", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.ENERGY_REGEN,
				blessingEndAt: new Date(Date.now() + 3600000)
			}));

			expect(manager.getEnergyRegenMultiplier()).toBe(BlessingConstants.ENERGY_REGEN_MULTIPLIER);
		});

		it("should return correct pet love multiplier when PET_LOVE is active", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.PET_LOVE,
				blessingEndAt: new Date(Date.now() + 3600000)
			}));

			expect(manager.getPetLoveMultiplier()).toBe(BlessingConstants.PET_LOVE_MULTIPLIER);
		});

		it("should return correct daily mission multiplier when DAILY_MISSION is active", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.DAILY_MISSION,
				blessingEndAt: new Date(Date.now() + 3600000)
			}));

			expect(manager.getDailyMissionMultiplier()).toBe(BlessingConstants.DAILY_MISSION_MULTIPLIER);
		});

		it("should return correct health potion multiplier when HEAL_ALL is active", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.HEAL_ALL,
				blessingEndAt: new Date(Date.now() + 3600000)
			}));

			expect(manager.getHealthPotionMultiplier()).toBe(BlessingConstants.HEALTH_POTION_MULTIPLIER);
		});

		it("should return true for isRageAmplified when AMPLIFIED_RAGE is active", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.AMPLIFIED_RAGE,
				blessingEndAt: new Date(Date.now() + 3600000)
			}));

			expect(manager.isRageAmplified()).toBe(true);
		});

		it("should return true for hasExpeditionTokenBonus when EXPEDITION_TOKEN is active", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.EXPEDITION_TOKEN,
				blessingEndAt: new Date(Date.now() + 3600000)
			}));

			expect(manager.hasExpeditionTokenBonus()).toBe(true);
		});
	});

	describe("canOracleAppear", () => {
		it("should return false when no blessing is cached", () => {
			const manager = createManager(null);

			expect(manager.canOracleAppear()).toBe(false);
		});

		it("should return false when a blessing is currently active", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.FIGHT_LOOT,
				blessingEndAt: new Date(Date.now() + 3600000)
			}));

			expect(manager.canOracleAppear()).toBe(false);
		});

		it("should return true when no blessing is active and none triggered today", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.NONE,
				blessingEndAt: null
			}));

			expect(manager.canOracleAppear()).toBe(true);
		});

		it("should return false when a blessing was triggered today (same day)", () => {
			const triggeredEarlierToday = new Date();
			triggeredEarlierToday.setHours(12, 0, 0, 0); // Fixed hour to avoid midnight edge case

			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.NONE,
				lastBlessingTriggeredAt: triggeredEarlierToday
			}));

			// Since the blessing was triggered today, oracle should not appear
			expect(manager.canOracleAppear()).toBe(false);
		});

		it("should return true when a blessing was triggered on a different day", () => {
			const triggeredYesterday = new Date();
			triggeredYesterday.setDate(triggeredYesterday.getDate() - 1);

			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.NONE,
				lastBlessingTriggeredAt: triggeredYesterday
			}));

			expect(manager.canOracleAppear()).toBe(true);
		});
	});

	describe("contribute", () => {
		it("should return false when no blessing is cached", async () => {
			const manager = createManager(null);

			const result = await manager.contribute(100, "test-keycloak");

			expect(result).toBe(false);
		});

		it("should add amount to pool and save when pool not filled", async () => {
			const mockBlessing = createMockBlessing({
				poolAmount: 100,
				poolThreshold: 5000
			});
			const manager = createManager(mockBlessing);

			const result = await manager.contribute(200, "test-keycloak");

			expect(result).toBe(false);
			expect(mockBlessing.poolAmount).toBe(300);
			expect(mockBlessing.save).toHaveBeenCalledOnce();
		});

		it("should trigger blessing when pool is filled", async () => {
			const mockBlessing = createMockBlessing({
				poolAmount: 4900,
				poolThreshold: 5000,
				poolStartedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
			});
			const manager = createManager(mockBlessing);

			const result = await manager.contribute(200, "test-keycloak");

			expect(result).toBe(true);
			expect(mockBlessing.activeBlessingType).not.toBe(BlessingType.NONE);
			expect(mockBlessing.poolAmount).toBe(0);
			expect(mockBlessing.lastTriggeredByKeycloakId).toBe("test-keycloak");
		});
	});

	describe("forceReset", () => {
		it("should reset all blessing state", async () => {
			const mockBlessing = createMockBlessing({
				activeBlessingType: BlessingType.FIGHT_LOOT,
				blessingEndAt: new Date(Date.now() + 3600000),
				poolAmount: 1000,
				lastTriggeredByKeycloakId: "test-player"
			});
			const manager = createManager(mockBlessing);

			await manager.forceReset();

			expect(mockBlessing.activeBlessingType).toBe(BlessingType.NONE);
			expect(mockBlessing.blessingEndAt).toBeNull();
			expect(mockBlessing.poolAmount).toBe(0);
			expect(mockBlessing.save).toHaveBeenCalledOnce();
		});
	});

	describe("forceSetPool", () => {
		it("should set pool amount and save", async () => {
			const mockBlessing = createMockBlessing({ poolAmount: 100 });
			const manager = createManager(mockBlessing);

			await manager.forceSetPool(4999);

			expect(mockBlessing.poolAmount).toBe(4999);
			expect(mockBlessing.save).toHaveBeenCalledOnce();
		});
	});

	describe("forceSetThreshold", () => {
		it("should set pool threshold and save", async () => {
			const mockBlessing = createMockBlessing({ poolThreshold: 5000 });
			const manager = createManager(mockBlessing);

			await manager.forceSetThreshold(1000);

			expect(mockBlessing.poolThreshold).toBe(1000);
			expect(mockBlessing.save).toHaveBeenCalledOnce();
		});
	});

	describe("forceActivateBlessing", () => {
		it("should activate a specific blessing type", async () => {
			const mockBlessing = createMockBlessing();
			const manager = createManager(mockBlessing);

			await manager.forceActivateBlessing(BlessingType.FIGHT_LOOT, "test-keycloak");

			expect(mockBlessing.activeBlessingType).toBe(BlessingType.FIGHT_LOOT);
			expect(mockBlessing.lastTriggeredByKeycloakId).toBe("test-keycloak");
			expect(mockBlessing.poolAmount).toBe(0);
			expect(mockBlessing.save).toHaveBeenCalledOnce();
			expect(manager.hasActiveBlessing()).toBe(true);
		});
	});

	describe("getters with no cached blessing", () => {
		it("should return safe defaults", () => {
			const manager = createManager(null);

			expect(manager.getPoolAmount()).toBe(0);
			expect(manager.getPoolThreshold()).toBe(BlessingConstants.INITIAL_POOL_THRESHOLD);
			expect(manager.getBlessingEndAt()).toBeNull();
			expect(manager.getLastTriggeredByKeycloakId()).toBeNull();
			expect(manager.getActiveBlessingType()).toBe(BlessingType.NONE);
		});
	});

	describe("calculateNewThreshold (via simulateNewThreshold)", () => {
		it("should keep threshold unchanged when filled in exactly TARGET_FILL_DAYS", () => {
			const manager = createManager(createMockBlessing({ poolThreshold: 5000 }));

			const result = manager.simulateNewThreshold(BlessingConstants.TARGET_FILL_DAYS);

			expect(result).toBe(5000);
		});

		it("should increase threshold when filled faster than target", () => {
			const manager = createManager(createMockBlessing({ poolThreshold: 5000 }));

			const result = manager.simulateNewThreshold(1); // 1 day, target is 3

			// ratio = 3/1 = 3, raw = 15000, delta = 10000 = MAX_THRESHOLD_STEP -> clamped to 15000
			expect(result).toBe(5000 + BlessingConstants.MAX_THRESHOLD_STEP);
		});

		it("should decrease threshold when filled slower than target", () => {
			const manager = createManager(createMockBlessing({ poolThreshold: 5000 }));

			const result = manager.simulateNewThreshold(6); // 6 days, target is 3

			// ratio = 3/6 = 0.5, raw = 2500, delta = -2500
			expect(result).toBe(2500);
		});

		it("should clamp delta to MAX_THRESHOLD_STEP for very fast fills", () => {
			const manager = createManager(createMockBlessing({ poolThreshold: 5000 }));

			const result = manager.simulateNewThreshold(0.1); // very fast

			// ratio = 3/0.1 = 30, raw = 150000, delta = 145000 > MAX_THRESHOLD_STEP -> 5000 + 10000
			expect(result).toBe(5000 + BlessingConstants.MAX_THRESHOLD_STEP);
		});

		it("should not go below MIN_POOL_THRESHOLD", () => {
			const manager = createManager(createMockBlessing({ poolThreshold: 500 }));

			const result = manager.simulateNewThreshold(100); // very slow

			// Result should be clamped to MIN_POOL_THRESHOLD
			expect(result).toBe(BlessingConstants.MIN_POOL_THRESHOLD);
		});

		it("should not go above MAX_POOL_THRESHOLD", () => {
			const manager = createManager(createMockBlessing({ poolThreshold: 495000 }));

			const result = manager.simulateNewThreshold(1); // fast fill on high threshold

			// ratio = 3, raw = 1485000, delta clamped -> 495000 + 10000 = 505000, then clamped to MAX
			expect(result).toBe(BlessingConstants.MAX_POOL_THRESHOLD);
		});

		it("should handle fillDurationDays of 0 by using minimum 0.1", () => {
			const manager = createManager(createMockBlessing({ poolThreshold: 5000 }));

			const result = manager.simulateNewThreshold(0);

			// Math.max(0, 0.1) = 0.1 -> same as very fast fill
			expect(result).toBe(5000 + BlessingConstants.MAX_THRESHOLD_STEP);
		});
	});

	describe("getInstance", () => {
		it("should return the same instance on every call", () => {
			const manager = createManager(null);

			expect(BlessingManager.getInstance()).toBe(manager);
		});
	});

	describe("getPoolExpiresAt", () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		it("should expire POOL_EXPIRY_DAYS after the pool started", () => {
			const poolStartedAt = new Date(2026, 2, 1, 10, 0, 0);
			const manager = createManager(createMockBlessing({ poolStartedAt }));

			expect(manager.getPoolExpiresAt().getTime()).toBe(poolStartedAt.getTime() + BlessingConstants.POOL_EXPIRY_DAYS * DAY_MS);
		});

		it("should count from now when no blessing is cached", () => {
			vi.useFakeTimers({ now: NOW });
			const manager = createManager(null);

			expect(manager.getPoolExpiresAt().getTime()).toBe(NOW.getTime() + BlessingConstants.POOL_EXPIRY_DAYS * DAY_MS);
		});
	});

	describe("applyMoneyBlessing", () => {
		it("should boost and round positive amounts when MONEY_BOOST is active", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.MONEY_BOOST,
				blessingEndAt: new Date(Date.now() + HOUR_MS)
			}));

			expect(manager.applyMoneyBlessing(1000)).toBe(1100);
			expect(manager.applyMoneyBlessing(15)).toBe(17);
		});

		it("should never boost a loss or a zero amount", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.MONEY_BOOST,
				blessingEndAt: new Date(Date.now() + HOUR_MS)
			}));

			expect(manager.applyMoneyBlessing(-55)).toBe(-55);
			expect(manager.applyMoneyBlessing(0)).toBe(0);
		});

		it("should leave the amount unchanged without MONEY_BOOST", () => {
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.SCORE_BOOST,
				blessingEndAt: new Date(Date.now() + HOUR_MS)
			}));

			expect(manager.applyMoneyBlessing(1000)).toBe(1000);
		});
	});

	describe("contribution tracking", () => {
		it("should accumulate contributions per player and log the new pool amount", async () => {
			const manager = createManager(createMockBlessing({ poolThreshold: 100000 }));

			await manager.contribute(100, "a");
			await manager.contribute(250, "b");
			await manager.contribute(200, "a");

			expect(manager.getTopContributor()).toEqual({
				keycloakId: "a", amount: 300
			});
			expect(manager.getTotalContributors()).toBe(2);
			expect(crowniclesInstance.logsDatabase.logBlessingContribution).toHaveBeenNthCalledWith(3, {
				keycloakId: "a",
				amount: 200,
				newPoolAmount: 550
			});
		});

		it("should keep the first contributor on a tie", async () => {
			const manager = createManager(createMockBlessing({ poolThreshold: 100000 }));

			await manager.contribute(2000, "a");
			await manager.contribute(2000, "b");

			expect(manager.getTopContributor()).toEqual({
				keycloakId: "a", amount: 2000
			});
		});

		it("should return null when nobody contributed", () => {
			const manager = createManager(createMockBlessing());

			expect(manager.getTopContributor()).toBeNull();
			expect(manager.getTotalContributors()).toBe(0);
		});

		it("should not log anything when no blessing is cached", async () => {
			const manager = createManager(null);

			await manager.contribute(100, "a");

			expect(crowniclesInstance.logsDatabase.logBlessingContribution).not.toHaveBeenCalled();
			expect(manager.getTotalContributors()).toBe(0);
		});

		it("should trigger the blessing when the pool reaches exactly the threshold", async () => {
			const mockBlessing = createMockBlessing({
				poolAmount: 4800,
				poolThreshold: 5000,
				poolStartedAt: new Date(Date.now() - 3 * DAY_MS)
			});
			const manager = createManager(mockBlessing);

			expect(await manager.contribute(200, "a")).toBe(true);
			expect(manager.hasActiveBlessing()).toBe(true);
		});
	});

	describe("triggerBlessing (via contribute)", () => {
		afterEach(() => {
			vi.useRealTimers();
			vi.mocked(RandomUtils.randInt).mockReturnValue(3);
		});

		/**
		 * Fill a pool of 5000 started `poolAgeDays` ago: "a" gives 1000 then "b" the remaining 4000
		 */
		async function fillPool(blessingType: BlessingType, durationHours: number, poolAgeDays = 6): Promise<{
			manager: BlessingManager; mockBlessing: Record<string, unknown>;
		}> {
			const mockBlessing = createMockBlessing({
				poolThreshold: 5000,
				poolStartedAt: new Date(Date.now() - poolAgeDays * DAY_MS)
			});
			const manager = createManager(mockBlessing);
			await manager.contribute(1000, "a");
			vi.mocked(RandomUtils.randInt).mockReturnValueOnce(blessingType).mockReturnValueOnce(durationHours);
			await manager.contribute(4000, "b");
			return {
				manager, mockBlessing
			};
		}

		it("should draw the type and duration in their full ranges", async () => {
			vi.useFakeTimers({ now: NOW });

			await fillPool(BlessingType.MONEY_BOOST, 10);

			expect(RandomUtils.randInt).toHaveBeenNthCalledWith(1, 1, BlessingConstants.TOTAL_BLESSING_TYPES + 1);
			expect(RandomUtils.randInt).toHaveBeenNthCalledWith(2, BlessingConstants.MIN_DURATION_HOURS, BlessingConstants.MAX_DURATION_HOURS + 1);
		});

		it("should activate the blessing, reprice the pool and start the next pool when the blessing ends", async () => {
			vi.useFakeTimers({ now: NOW });

			const {
				manager, mockBlessing
			} = await fillPool(BlessingType.MONEY_BOOST, 10);

			const expectedEnd = NOW.getTime() + 10 * HOUR_MS;
			expect(mockBlessing.activeBlessingType).toBe(BlessingType.MONEY_BOOST);
			expect((mockBlessing.blessingEndAt as Date).getTime()).toBe(expectedEnd);
			expect((mockBlessing.poolStartedAt as Date).getTime()).toBe(expectedEnd);
			expect((mockBlessing.lastBlessingTriggeredAt as Date).getTime()).toBe(NOW.getTime());
			expect(mockBlessing.lastTriggeredByKeycloakId).toBe("b");
			expect(mockBlessing.poolAmount).toBe(0);

			// Filled in 6 days for a target of 3: the threshold is halved
			expect(mockBlessing.poolThreshold).toBe(2500);
			expect(mockBlessing.save).toHaveBeenCalledTimes(2);
			expect(manager.getTotalContributors()).toBe(0);
			expect(PlayerMissionsInfo.findAll).not.toHaveBeenCalled();
		});

		it("should announce the blessing with the contribution stats of the cycle", async () => {
			vi.useFakeTimers({ now: NOW });

			await fillPool(BlessingType.MONEY_BOOST, 10);

			expect(PacketUtils.announce).toHaveBeenCalledOnce();
			const [packet, topic] = vi.mocked(PacketUtils.announce).mock.calls[0];
			expect(packet).toBeInstanceOf(BlessingAnnouncementPacket);
			expect({ ...packet }).toEqual({
				blessingType: BlessingType.MONEY_BOOST,
				triggeredByKeycloakId: "b",
				durationHours: 10,
				topContributorKeycloakId: "b",
				topContributorAmount: 4000,
				totalContributors: 2
			});
			expect(topic).toBe("test/topic");
			expect(crowniclesInstance.logsDatabase.logBlessingActivation).toHaveBeenCalledWith({
				blessingType: BlessingType.MONEY_BOOST,
				triggeredByKeycloakId: "b",
				poolThreshold: 5000,
				durationHours: 10
			});
		});

		it("should not shorten a non daily mission blessing at midnight", async () => {
			vi.useFakeTimers({ now: new Date(2026, 2, 10, 20, 30, 0) });

			const { mockBlessing } = await fillPool(BlessingType.FIGHT_LOOT, 10);

			expect((mockBlessing.blessingEndAt as Date).getTime()).toBe(new Date(2026, 2, 11, 6, 30, 0).getTime());
		});

		it("should end a daily mission blessing at midnight and announce the remaining whole hours", async () => {
			vi.useFakeTimers({ now: new Date(2026, 2, 10, 20, 30, 0) });

			const { mockBlessing } = await fillPool(BlessingType.DAILY_MISSION, 10);

			expect((mockBlessing.blessingEndAt as Date).getTime()).toBe(new Date(2026, 2, 11, 0, 0, 0).getTime());
			expect(vi.mocked(PacketUtils.announce).mock.calls[0][0]).toMatchObject({ durationHours: 3 });
			expect(PlayerMissionsInfo.findAll).toHaveBeenCalledOnce();
		});

		it("should announce at least one hour for a daily mission blessing triggered just before midnight", async () => {
			vi.useFakeTimers({ now: new Date(2026, 2, 10, 23, 45, 0) });

			await fillPool(BlessingType.DAILY_MISSION, 10);

			expect(vi.mocked(PacketUtils.announce).mock.calls[0][0]).toMatchObject({ durationHours: 1 });
		});

		it("should keep the full duration of a daily mission blessing ending before midnight", async () => {
			vi.useFakeTimers({ now: new Date(2026, 2, 10, 8, 0, 0) });

			const { mockBlessing } = await fillPool(BlessingType.DAILY_MISSION, 10);

			expect((mockBlessing.blessingEndAt as Date).getTime()).toBe(new Date(2026, 2, 10, 18, 0, 0).getTime());
			expect(vi.mocked(PacketUtils.announce).mock.calls[0][0]).toMatchObject({ durationHours: 10 });
		});
	});

	describe("applyRetroactiveDailyMission (via forceActivateBlessing)", () => {
		afterEach(() => {
			vi.useRealTimers();
			vi.mocked(PlayerMissionsInfo.findAll).mockResolvedValue([]);
		});

		it("should look for the players who completed their daily mission since midnight", async () => {
			vi.useFakeTimers({ now: NOW });
			const manager = createManager(createMockBlessing());

			await manager.forceActivateBlessing(BlessingType.DAILY_MISSION, "kc");

			expect(PlayerMissionsInfo.findAll).toHaveBeenCalledWith({
				where: { lastDailyMissionCompleted: { [Op.gte]: new Date(2026, 2, 10, 0, 0, 0) } }
			});
			expect(DailyMissions.getOrGenerate).not.toHaveBeenCalled();
		});

		it("should give the daily mission rewards again to the players who already completed it", async () => {
			const missionInfo = {
				playerId: 7,
				addGems: vi.fn().mockResolvedValue(undefined)
			};
			const player = {
				keycloakId: "kc7",
				addExperience: vi.fn().mockResolvedValue(undefined),
				addMoney: vi.fn().mockResolvedValue(undefined),
				addScore: vi.fn().mockResolvedValue(undefined),
				save: vi.fn().mockResolvedValue(undefined)
			};
			vi.mocked(PlayerMissionsInfo.findAll).mockResolvedValue([missionInfo] as unknown as Awaited<ReturnType<typeof PlayerMissionsInfo.findAll>>); // Partial model fixture
			vi.mocked(Players.getById).mockResolvedValue(player as unknown as Awaited<ReturnType<typeof Players.getById>>); // Partial model fixture
			const manager = createManager(createMockBlessing());

			await manager.forceActivateBlessing(BlessingType.DAILY_MISSION, "kc");

			expect(Players.getById).toHaveBeenCalledWith(7);
			expect(missionInfo.addGems).toHaveBeenCalledWith(5, "kc7", "blessing");
			expect(player.addExperience).toHaveBeenCalledWith({
				amount: 100, response: [], reason: "blessing"
			});
			expect(player.addMoney).toHaveBeenCalledWith({
				amount: 100, response: [], reason: "blessing"
			});
			expect(player.addScore).toHaveBeenCalledWith({
				amount: 60, response: [], reason: "blessing"
			});
			expect(player.save).toHaveBeenCalledOnce();
		});
	});

	describe("init", () => {
		afterEach(() => {
			vi.clearAllTimers();
			vi.useRealTimers();
		});

		/**
		 * Build a manager whose state is loaded from the mocked database by init()
		 */
		async function initWith(mockBlessing: Record<string, unknown> | null): Promise<BlessingManager> {
			vi.mocked(GlobalBlessings.get).mockResolvedValue(mockBlessing as unknown as Awaited<ReturnType<typeof GlobalBlessings.get>>); // Partial model fixture
			const manager = createManager(null);
			await manager.init();
			return manager;
		}

		it("should reset an expired blessing to a fresh pool and log it", async () => {
			vi.useFakeTimers({ now: NOW });
			const mockBlessing = createMockBlessing({
				activeBlessingType: BlessingType.FIGHT_LOOT,
				blessingEndAt: new Date(NOW.getTime() - HOUR_MS),
				poolAmount: 300,
				poolThreshold: 8000,
				poolStartedAt: new Date(NOW.getTime() - 5 * DAY_MS)
			});

			const manager = await initWith(mockBlessing);

			expect(mockBlessing.activeBlessingType).toBe(BlessingType.NONE);
			expect(mockBlessing.blessingEndAt).toBeNull();
			expect(mockBlessing.poolAmount).toBe(0);
			expect((mockBlessing.poolStartedAt as Date).getTime()).toBe(NOW.getTime());
			expect(mockBlessing.poolThreshold).toBe(8000);
			expect(mockBlessing.save).toHaveBeenCalledOnce();
			expect(crowniclesInstance.logsDatabase.logBlessingExpiration).toHaveBeenCalledWith(BlessingType.FIGHT_LOOT, 8000);
			expect(crowniclesInstance.logsDatabase.logBlessingPoolExpiration).not.toHaveBeenCalled();
			expect(manager.canOracleAppear()).toBe(true);
		});

		it("should consider a blessing ending right now as expired", async () => {
			vi.useFakeTimers({ now: NOW });
			const mockBlessing = createMockBlessing({
				activeBlessingType: BlessingType.FIGHT_LOOT,
				blessingEndAt: new Date(NOW.getTime())
			});

			const manager = await initWith(mockBlessing);

			expect(mockBlessing.activeBlessingType).toBe(BlessingType.NONE);
			expect(manager.hasActiveBlessing()).toBe(false);
		});

		it("should keep a running blessing even when its pool started long ago", async () => {
			vi.useFakeTimers({ now: NOW });
			const mockBlessing = createMockBlessing({
				activeBlessingType: BlessingType.FIGHT_LOOT,
				blessingEndAt: new Date(NOW.getTime() + 1000),
				poolAmount: 300,
				poolStartedAt: new Date(NOW.getTime() - 10 * DAY_MS)
			});

			const manager = await initWith(mockBlessing);

			expect(manager.isActive(BlessingType.FIGHT_LOOT)).toBe(true);
			expect(mockBlessing.poolAmount).toBe(300);
			expect(mockBlessing.save).not.toHaveBeenCalled();
			expect(crowniclesInstance.logsDatabase.logBlessingExpiration).not.toHaveBeenCalled();
			expect(crowniclesInstance.logsDatabase.logBlessingPoolExpiration).not.toHaveBeenCalled();
		});

		it("should not log a blessing expiration when no blessing was active", async () => {
			vi.useFakeTimers({ now: NOW });
			const mockBlessing = createMockBlessing({
				activeBlessingType: BlessingType.NONE,
				blessingEndAt: new Date(NOW.getTime() - HOUR_MS),
				poolAmount: 300
			});

			await initWith(mockBlessing);

			expect(mockBlessing.poolAmount).toBe(300);
			expect(crowniclesInstance.logsDatabase.logBlessingExpiration).not.toHaveBeenCalled();
		});

		it("should not reset a blessing without end date", async () => {
			vi.useFakeTimers({ now: NOW });
			const mockBlessing = createMockBlessing({
				activeBlessingType: BlessingType.FIGHT_LOOT,
				blessingEndAt: null,
				poolAmount: 300
			});

			await initWith(mockBlessing);

			expect(mockBlessing.activeBlessingType).toBe(BlessingType.FIGHT_LOOT);
			expect(mockBlessing.poolAmount).toBe(300);
			expect(mockBlessing.save).not.toHaveBeenCalled();
		});

		it("should halve the threshold of a pool not filled after POOL_EXPIRY_DAYS", async () => {
			vi.useFakeTimers({ now: NOW });
			const mockBlessing = createMockBlessing({
				poolAmount: 1200,
				poolThreshold: 8001,
				poolStartedAt: new Date(NOW.getTime() - BlessingConstants.POOL_EXPIRY_DAYS * DAY_MS)
			});

			await initWith(mockBlessing);

			expect(mockBlessing.poolThreshold).toBe(4001);
			expect(mockBlessing.poolAmount).toBe(0);
			expect((mockBlessing.poolStartedAt as Date).getTime()).toBe(NOW.getTime());
			expect(mockBlessing.save).toHaveBeenCalledOnce();
			expect(crowniclesInstance.logsDatabase.logBlessingPoolExpiration).toHaveBeenCalledWith(4001);
		});

		it("should not lower an expired pool threshold under MIN_POOL_THRESHOLD", async () => {
			vi.useFakeTimers({ now: NOW });
			const mockBlessing = createMockBlessing({
				poolThreshold: 600,
				poolStartedAt: new Date(NOW.getTime() - 5 * DAY_MS)
			});

			await initWith(mockBlessing);

			expect(mockBlessing.poolThreshold).toBe(BlessingConstants.MIN_POOL_THRESHOLD);
		});

		it("should keep a pool younger than POOL_EXPIRY_DAYS", async () => {
			vi.useFakeTimers({ now: NOW });
			const mockBlessing = createMockBlessing({
				poolAmount: 1200,
				poolThreshold: 8000,
				poolStartedAt: new Date(NOW.getTime() - BlessingConstants.POOL_EXPIRY_DAYS * DAY_MS + 1000)
			});

			await initWith(mockBlessing);

			expect(mockBlessing.poolThreshold).toBe(8000);
			expect(mockBlessing.poolAmount).toBe(1200);
			expect(mockBlessing.save).not.toHaveBeenCalled();
		});

		it("should rebuild the contributions of the current pool from the logs", async () => {
			vi.useFakeTimers({ now: NOW });
			const poolStartedAt = new Date(NOW.getTime() - DAY_MS);
			vi.mocked(crowniclesInstance.logsDatabase.getContributionsSince).mockResolvedValueOnce(new Map([["a", 100], ["b", 300]]));

			const manager = await initWith(createMockBlessing({ poolStartedAt }));

			expect(crowniclesInstance.logsDatabase.getContributionsSince).toHaveBeenCalledWith(poolStartedAt);
			expect(manager.getTopContributor()).toEqual({
				keycloakId: "b", amount: 300
			});
			expect(manager.getTotalContributors()).toBe(2);
		});

		it("should do nothing when the database has no blessing row", async () => {
			vi.useFakeTimers({ now: NOW });

			const manager = await initWith(null);

			expect(crowniclesInstance.logsDatabase.getContributionsSince).not.toHaveBeenCalled();
			expect(manager.canOracleAppear()).toBe(false);
		});

		it("should check the expiry every 5 minutes with a single timer", async () => {
			vi.useFakeTimers({ now: NOW });
			const mockBlessing = createMockBlessing({
				activeBlessingType: BlessingType.FIGHT_LOOT,
				blessingEndAt: new Date(NOW.getTime() + 60_000)
			});
			vi.mocked(GlobalBlessings.get).mockResolvedValue(mockBlessing as unknown as Awaited<ReturnType<typeof GlobalBlessings.get>>); // Partial model fixture
			const manager = createManager(null);
			await manager.init();
			await manager.init();

			expect(vi.getTimerCount()).toBe(1);
			await vi.advanceTimersByTimeAsync(4 * 60_000);
			expect(mockBlessing.activeBlessingType).toBe(BlessingType.FIGHT_LOOT);
			await vi.advanceTimersByTimeAsync(60_000);
			expect(mockBlessing.activeBlessingType).toBe(BlessingType.NONE);
			expect(crowniclesInstance.logsDatabase.logBlessingExpiration).toHaveBeenCalledOnce();
		});

		it("should also check the pool expiry in the periodic check", async () => {
			vi.useFakeTimers({ now: NOW });
			const mockBlessing = createMockBlessing({
				poolThreshold: 8000,
				poolStartedAt: new Date(NOW.getTime() - BlessingConstants.POOL_EXPIRY_DAYS * DAY_MS + 60_000)
			});
			vi.mocked(GlobalBlessings.get).mockResolvedValue(mockBlessing as unknown as Awaited<ReturnType<typeof GlobalBlessings.get>>); // Partial model fixture
			await createManager(null).init();
			expect(mockBlessing.poolThreshold).toBe(8000);

			await vi.advanceTimersByTimeAsync(5 * 60_000);

			expect(mockBlessing.poolThreshold).toBe(4000);
		});
	});

	describe("blessing end boundary", () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		it("should consider a blessing inactive from its exact end date", () => {
			vi.useFakeTimers({ now: NOW });
			const manager = createManager(createMockBlessing({
				activeBlessingType: BlessingType.FIGHT_LOOT,
				blessingEndAt: new Date(NOW.getTime())
			}));

			expect(manager.hasActiveBlessing()).toBe(false);
		});
	});

	describe("forced test commands", () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		it("should announce a forced blessing of 12 hours credited to its author", async () => {
			vi.useFakeTimers({ now: NOW });
			const mockBlessing = createMockBlessing({ poolThreshold: 100000 });
			const manager = createManager(mockBlessing);
			await manager.contribute(500, "someone");

			await manager.forceActivateBlessing(BlessingType.PET_LOVE, "kc");

			const expectedEnd = NOW.getTime() + 12 * HOUR_MS;
			expect((mockBlessing.blessingEndAt as Date).getTime()).toBe(expectedEnd);
			expect((mockBlessing.poolStartedAt as Date).getTime()).toBe(expectedEnd);
			expect((mockBlessing.lastBlessingTriggeredAt as Date).getTime()).toBe(NOW.getTime());
			expect(manager.getTotalContributors()).toBe(0);
			expect({ ...vi.mocked(PacketUtils.announce).mock.calls[0][0] }).toEqual({
				blessingType: BlessingType.PET_LOVE,
				triggeredByKeycloakId: "kc",
				durationHours: 12,
				topContributorKeycloakId: "kc",
				topContributorAmount: 0,
				totalContributors: 0
			});
			expect(PlayerMissionsInfo.findAll).not.toHaveBeenCalled();
		});

		it("should restart the pool and forget contributions on reset", async () => {
			vi.useFakeTimers({ now: NOW });
			const mockBlessing = createMockBlessing({
				poolThreshold: 100000,
				poolStartedAt: new Date(NOW.getTime() - DAY_MS)
			});
			const manager = createManager(mockBlessing);
			await manager.contribute(500, "someone");

			await manager.forceReset();

			expect((mockBlessing.poolStartedAt as Date).getTime()).toBe(NOW.getTime());
			expect(manager.getTotalContributors()).toBe(0);
		});

		it("should set the pool start date and save", async () => {
			const mockBlessing = createMockBlessing();
			const manager = createManager(mockBlessing);
			const date = new Date(2026, 0, 1);

			await manager.forceSetPoolStartedAt(date);

			expect(mockBlessing.poolStartedAt).toBe(date);
			expect(mockBlessing.save).toHaveBeenCalledOnce();
		});

		it("should ignore every forced command when no blessing is cached", async () => {
			const manager = createManager(null);

			await expect(manager.forceActivateBlessing(BlessingType.PET_LOVE, "kc")).resolves.toBeUndefined();
			await expect(manager.forceReset()).resolves.toBeUndefined();
			await expect(manager.forceSetPool(10)).resolves.toBeUndefined();
			await expect(manager.forceSetThreshold(10)).resolves.toBeUndefined();
			await expect(manager.forceSetPoolStartedAt(new Date())).resolves.toBeUndefined();
			expect(PacketUtils.announce).not.toHaveBeenCalled();
		});
	});

	describe("calculateNewThreshold clamping on decrease", () => {
		it("should limit a large decrease to MAX_THRESHOLD_STEP", () => {
			const manager = createManager(createMockBlessing({ poolThreshold: 30000 }));

			expect(manager.simulateNewThreshold(30)).toBe(30000 - BlessingConstants.MAX_THRESHOLD_STEP);
		});
	});
});
