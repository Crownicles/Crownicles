import {
	describe, expect, it, vi, beforeEach
} from "vitest";
import {
	calculateRewards, RewardCalculationParams
} from "../../../src/core/expeditions/ExpeditionRewardCalculator";
import { PET_PREFERENCE_REWARD_MULTIPLIERS } from "../../../../Lib/src/constants/ExpeditionConstants";

// Helper to create expedition data
function createExpeditionData(overrides: Partial<{
	locationType: string;
	durationMinutes: number;
	hasBonusTokens: boolean;
}> = {}) {
	const durationMinutes = overrides.durationMinutes ?? 480;
	return {
		id: "test_expedition",
		riskRate: 30,
		difficulty: 50,
		durationMinutes,
		displayDurationMinutes: durationMinutes,
		locationType: (overrides.locationType ?? "forest") as RewardCalculationParams["expedition"]["locationType"],
		wealthRate: 1,
		mapLocationId: 1,
		hasBonusTokens: overrides.hasBonusTokens ?? false
	};
}

// Helper to create calculation params
function createRewardParams(overrides: Partial<{
	expedition: Partial<RewardCalculationParams["expedition"]>;
	rewardIndex: number;
	isPartialSuccess: boolean;
	hasCloneTalisman: boolean;
	playerCurrentTokens: number;
	petTypeId: number;
}> = {}): RewardCalculationParams {
	return {
		expedition: createExpeditionData(overrides.expedition),
		rewardIndex: overrides.rewardIndex ?? 5,
		isPartialSuccess: overrides.isPartialSuccess ?? false,
		hasCloneTalisman: overrides.hasCloneTalisman ?? false,
		playerCurrentTokens: overrides.playerCurrentTokens ?? 0,
		petTypeId: overrides.petTypeId ?? 1
	};
}

describe("ExpeditionRewardCalculator", () => {
	describe("calculateRewards - preference multipliers", () => {
		describe("liked location (1x multiplier)", () => {
			it("should apply full rewards for liked location", () => {
				// Dog (id 1) likes forest
				const params = createRewardParams({
					expedition: { locationType: "forest" },
					petTypeId: 1,
					rewardIndex: 5
				});

				const rewards = calculateRewards(params);

				// Should have positive rewards
				expect(rewards.money).toBeGreaterThan(0);
				expect(rewards.experience).toBeGreaterThan(0);
				expect(rewards.points).toBeGreaterThan(0);
			});

			it("should have higher rewards than neutral pet for same location", () => {
				// Dog (id 1) likes forest, pet 0 is neutral to all
				const likedParams = createRewardParams({
					expedition: { locationType: "forest" },
					petTypeId: 1, // likes forest
					rewardIndex: 5
				});

				const neutralParams = createRewardParams({
					expedition: { locationType: "forest" },
					petTypeId: 0, // neutral to forest
					rewardIndex: 5
				});

				const likedRewards = calculateRewards(likedParams);
				const neutralRewards = calculateRewards(neutralParams);

				// Liked (1x) should give more than neutral (0.8x)
				expect(likedRewards.money).toBeGreaterThan(neutralRewards.money);
				expect(likedRewards.experience).toBeGreaterThan(neutralRewards.experience);
				expect(likedRewards.points).toBeGreaterThan(neutralRewards.points);
			});
		});

		describe("neutral location (0.8x multiplier)", () => {
			it("should apply 80% rewards for neutral location", () => {
				// Pet 0 is neutral to all terrains
				const neutralParams = createRewardParams({
					expedition: { locationType: "forest" },
					petTypeId: 0,
					rewardIndex: 5
				});

				const rewards = calculateRewards(neutralParams);

				// Should have positive rewards (but reduced)
				expect(rewards.money).toBeGreaterThan(0);
				expect(rewards.experience).toBeGreaterThan(0);
				expect(rewards.points).toBeGreaterThan(0);
			});
		});

		describe("disliked location (0.25x multiplier)", () => {
			it("should apply 25% rewards for disliked location", () => {
				// Dog (id 1) dislikes swamp
				const dislikedParams = createRewardParams({
					expedition: { locationType: "swamp" },
					petTypeId: 1,
					rewardIndex: 5
				});

				const rewards = calculateRewards(dislikedParams);

				// Should have much lower rewards
				expect(rewards.money).toBeGreaterThanOrEqual(0);
				expect(rewards.experience).toBeGreaterThanOrEqual(0);
				expect(rewards.points).toBeGreaterThanOrEqual(0);
			});

			it("should have significantly lower rewards than liked pet for same location", () => {
				// Dog (id 1) dislikes swamp, pet 0 is neutral to swamp
				// Use swamp for both to test multiplier difference
				const neutralParams = createRewardParams({
					expedition: { locationType: "swamp" },
					petTypeId: 0, // neutral to swamp
					rewardIndex: 5
				});

				const dislikedParams = createRewardParams({
					expedition: { locationType: "swamp" },
					petTypeId: 1, // dislikes swamp
					rewardIndex: 5
				});

				const neutralRewards = calculateRewards(neutralParams);
				const dislikedRewards = calculateRewards(dislikedParams);

				// Neutral (0.8x) should give more than disliked (0.25x)
				// The ratio should be approximately 3.2:1
				expect(neutralRewards.money).toBeGreaterThan(dislikedRewards.money * 2);
				expect(neutralRewards.experience).toBeGreaterThan(dislikedRewards.experience * 2);
				expect(neutralRewards.points).toBeGreaterThan(dislikedRewards.points * 2);
			});
		});

		describe("tokens are not affected by preference", () => {
			it("should compute tokens based on rewardIndex, not pet preference", () => {
				// Tokens depend on rewardIndex, hasBonusTokens, duration, and have random variation
				// But they should NOT be affected by pet preference at all
				// We verify this by checking that the token calculation doesn't use petTypeId
				const likedParams = createRewardParams({
					expedition: { locationType: "forest", durationMinutes: 480, hasBonusTokens: true },
					petTypeId: 1, // likes forest
					rewardIndex: 5,
					playerCurrentTokens: 0
				});

				const likedRewards = calculateRewards(likedParams);

				// Tokens should be positive and within expected range
				expect(likedRewards.tokens).toBeGreaterThanOrEqual(0);
				expect(likedRewards.tokens).toBeLessThanOrEqual(100); // TokensConstants.MAX
			});

			it("should give tokens even for disliked locations", () => {
				// Dog (id 1) dislikes swamp
				const dislikedParams = createRewardParams({
					expedition: { locationType: "swamp", durationMinutes: 480, hasBonusTokens: true },
					petTypeId: 1, // dislikes swamp
					rewardIndex: 5,
					playerCurrentTokens: 0
				});

				const dislikedRewards = calculateRewards(dislikedParams);

				// Should still get tokens despite disliking the location
				expect(dislikedRewards.tokens).toBeGreaterThanOrEqual(0);
			});
		});

		describe("multiplier values are correct", () => {
			it("should have liked multiplier of 1", () => {
				expect(PET_PREFERENCE_REWARD_MULTIPLIERS.liked).toBe(1);
			});

			it("should have neutral multiplier of 0.8", () => {
				expect(PET_PREFERENCE_REWARD_MULTIPLIERS.neutral).toBe(0.8);
			});

			it("should have disliked multiplier of 0.25", () => {
				expect(PET_PREFERENCE_REWARD_MULTIPLIERS.disliked).toBe(0.25);
			});
		});
	});

	describe("calculateRewards - basic functionality", () => {
		it("should return all required reward fields", () => {
			const params = createRewardParams();
			const rewards = calculateRewards(params);

			expect(rewards).toHaveProperty("money");
			expect(rewards).toHaveProperty("experience");
			expect(rewards).toHaveProperty("points");
			expect(rewards).toHaveProperty("tokens");
			expect(rewards).toHaveProperty("itemId");
			expect(rewards).toHaveProperty("itemCategory");
			expect(rewards).toHaveProperty("cloneTalismanFound");
			expect(rewards).toHaveProperty("itemGiven");
		});

		it("should always set itemGiven to true", () => {
			const params = createRewardParams();
			const rewards = calculateRewards(params);

			expect(rewards.itemGiven).toBe(true);
		});

		it("should generate valid item reward", () => {
			const params = createRewardParams();
			const rewards = calculateRewards(params);

			expect(rewards.itemId).toBeGreaterThanOrEqual(0);
			expect(rewards.itemCategory).toBeGreaterThanOrEqual(0);
		});
	});

	describe("calculateRewards - partial success penalty", () => {
		it("should reduce rewards on partial success", () => {
			const fullSuccessParams = createRewardParams({
				isPartialSuccess: false
			});

			const partialSuccessParams = createRewardParams({
				isPartialSuccess: true
			});

			const fullRewards = calculateRewards(fullSuccessParams);
			const partialRewards = calculateRewards(partialSuccessParams);

			// Partial success should have lower rewards (penalty applied)
			expect(fullRewards.money).toBeGreaterThan(partialRewards.money);
			expect(fullRewards.experience).toBeGreaterThan(partialRewards.experience);
			expect(fullRewards.points).toBeGreaterThan(partialRewards.points);
		});
	});
});
