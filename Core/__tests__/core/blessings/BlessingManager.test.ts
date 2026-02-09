import {
	describe, it, expect, vi, beforeEach
} from "vitest";
import { BlessingManager } from "../../../src/core/blessings/BlessingManager";
import {
	BlessingConstants, BlessingType
} from "../../../../Lib/src/constants/BlessingConstants";

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

vi.mock("../../../src/index", () => ({
	botConfig: { PREFIX: "test" as string & { readonly __brand: "MqttPrefix" } },
	crowniclesInstance: {
		logsDatabase: {
			logBlessingContribution: vi.fn().mockResolvedValue(undefined),
			logBlessingActivation: vi.fn().mockResolvedValue(undefined),
			logBlessingExpiration: vi.fn().mockResolvedValue(undefined),
			logBlessingPoolExpiration: vi.fn().mockResolvedValue(undefined)
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

			// ratio = 3/1 = 3, raw = 15000, delta = 10000 = MAX_THRESHOLD_STEP → clamped to 15000
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

			// ratio = 3/0.1 = 30, raw = 150000, delta = 145000 > MAX_THRESHOLD_STEP → 5000 + 10000
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

			// ratio = 3, raw = 1485000, delta clamped → 495000 + 10000 = 505000, then clamped to MAX
			expect(result).toBe(BlessingConstants.MAX_POOL_THRESHOLD);
		});

		it("should handle fillDurationDays of 0 by using minimum 0.1", () => {
			const manager = createManager(createMockBlessing({ poolThreshold: 5000 }));

			const result = manager.simulateNewThreshold(0);

			// Math.max(0, 0.1) = 0.1 → same as very fast fill
			expect(result).toBe(5000 + BlessingConstants.MAX_THRESHOLD_STEP);
		});
	});
});
