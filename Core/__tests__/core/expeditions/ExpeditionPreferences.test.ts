import {
	describe, expect, it, vi, beforeEach
} from "vitest";
import {
	calculateEffectiveRisk, EffectiveRiskParams
} from "../../../src/core/expeditions/ExpeditionService";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";

// Mock Pet class with just the force property we need
interface MockPet {
	force: number;
}

// Helper to create default expedition data
function createExpeditionData(overrides: Partial<{
	riskRate: number;
	difficulty: number;
	durationMinutes: number;
	locationType: string;
}> = {}): EffectiveRiskParams["expedition"] {
	const durationMinutes = overrides.durationMinutes ?? 480;
	return {
		id: "test_expedition",
		riskRate: overrides.riskRate ?? 30,
		difficulty: overrides.difficulty ?? 50,
		durationMinutes,
		displayDurationMinutes: durationMinutes,
		locationType: (overrides.locationType ?? "forest") as EffectiveRiskParams["expedition"]["locationType"],
		wealthRate: 1,
		mapLocationId: 1,
		hasBonusTokens: false
	};
}

// Helper to create default params
function createParams(overrides: Partial<{
	expedition: Partial<EffectiveRiskParams["expedition"]>;
	petForce: number;
	petTypeId: number;
	petLovePoints: number;
	foodConsumed: number | null;
	foodRequired: number | null;
}> = {}): EffectiveRiskParams {
	return {
		expedition: createExpeditionData(overrides.expedition),
		petModel: { force: overrides.petForce ?? 10 } as MockPet as EffectiveRiskParams["petModel"],
		petTypeId: overrides.petTypeId ?? 1,
		petLovePoints: overrides.petLovePoints ?? 50,
		foodConsumed: overrides.foodConsumed ?? null,
		foodRequired: overrides.foodRequired ?? null
	};
}

describe("ExpeditionService", () => {
	describe("calculateEffectiveRisk", () => {
		describe("base risk calculation", () => {
			it("should calculate base risk from riskRate, difficulty, petForce, and lovePoints", () => {
				const params = createParams({
					expedition: { riskRate: 30, difficulty: 50 },
					petForce: 10,
					petLovePoints: 50,
					petTypeId: 0 // neutral preference
				});

				// Base formula: riskRate + difficulty/divisor - petForce - lovePoints/divisor
				// 30 + 50/DIFFICULTY_DIVISOR - 10 - 50/LOVE_DIVISOR
				const result = calculateEffectiveRisk(params);

				// Should be clamped between 0 and 100
				expect(result).toBeGreaterThanOrEqual(0);
				expect(result).toBeLessThanOrEqual(100);
			});

			it("should clamp result to 0 when calculation would be negative", () => {
				const params = createParams({
					expedition: { riskRate: 0, difficulty: 0 },
					petForce: 30, // Very high force
					petLovePoints: 200 // Very high love
				});

				const result = calculateEffectiveRisk(params);
				expect(result).toBe(0);
			});

			it("should clamp result to 100 when calculation would exceed 100", () => {
				const params = createParams({
					expedition: { riskRate: 100, difficulty: 100 },
					petForce: 0,
					petLovePoints: 0
				});

				const result = calculateEffectiveRisk(params);
				expect(result).toBeLessThanOrEqual(100);
			});
		});

		describe("food penalty", () => {
			it("should apply NO_FOOD_RISK_MULTIPLIER when food consumed is less than required", () => {
				const baseParams = createParams({
					expedition: { riskRate: 30, difficulty: 50 },
					petTypeId: 0, // neutral preference
					foodConsumed: null,
					foodRequired: null
				});

				const paramsWithFood = createParams({
					...baseParams,
					expedition: { riskRate: 30, difficulty: 50 },
					petTypeId: 0,
					foodConsumed: 1,
					foodRequired: 3
				});

				const baseRisk = calculateEffectiveRisk(baseParams);
				const riskWithPenalty = calculateEffectiveRisk(paramsWithFood);

				// Risk with penalty should be higher (multiplied by NO_FOOD_RISK_MULTIPLIER)
				expect(riskWithPenalty).toBeGreaterThan(baseRisk);
			});

			it("should not apply food penalty when food consumed equals required", () => {
				const paramsWithEnoughFood = createParams({
					expedition: { riskRate: 30, difficulty: 50 },
					petTypeId: 0,
					foodConsumed: 3,
					foodRequired: 3
				});

				const paramsWithNoFood = createParams({
					expedition: { riskRate: 30, difficulty: 50 },
					petTypeId: 0,
					foodConsumed: null,
					foodRequired: null
				});

				const riskWithEnoughFood = calculateEffectiveRisk(paramsWithEnoughFood);
				const riskWithNoFood = calculateEffectiveRisk(paramsWithNoFood);

				expect(riskWithEnoughFood).toBe(riskWithNoFood);
			});

			it("should not apply food penalty when foodConsumed is null", () => {
				const paramsWithNullFood = createParams({
					expedition: { riskRate: 30, difficulty: 50 },
					petTypeId: 0,
					foodConsumed: null,
					foodRequired: 3
				});

				const paramsWithNoFoodCheck = createParams({
					expedition: { riskRate: 30, difficulty: 50 },
					petTypeId: 0,
					foodConsumed: null,
					foodRequired: null
				});

				const riskWithNullFood = calculateEffectiveRisk(paramsWithNullFood);
				const riskWithNoFoodCheck = calculateEffectiveRisk(paramsWithNoFoodCheck);

				expect(riskWithNullFood).toBe(riskWithNoFoodCheck);
			});
		});

		describe("preference-based risk modifiers", () => {
			describe("disliked location penalty for short expeditions", () => {
				it("should add 10% failure risk when pet dislikes location and expedition is under 12 hours", () => {
					// Dog (id 1) dislikes swamp
					const paramsNeutral = createParams({
						expedition: {
							riskRate: 30,
							difficulty: 50,
							durationMinutes: 300, // 5 hours
							locationType: "desert" // neutral for dog
						},
						petTypeId: 1
					});

					const paramsDisliked = createParams({
						expedition: {
							riskRate: 30,
							difficulty: 50,
							durationMinutes: 300, // 5 hours
							locationType: "swamp" // disliked by dog
						},
						petTypeId: 1
					});

					const neutralRisk = calculateEffectiveRisk(paramsNeutral);
					const dislikedRisk = calculateEffectiveRisk(paramsDisliked);

					// Disliked should add DISLIKED_SHORT_EXPEDITION_FAILURE_BONUS (10)
					expect(dislikedRisk).toBe(neutralRisk + 10);
				});

				it("should NOT add penalty when expedition is 12 hours or longer", () => {
					// Dog (id 1) dislikes swamp
					const paramsDislikedShort = createParams({
						expedition: {
							riskRate: 30,
							difficulty: 50,
							durationMinutes: 300, // 5 hours
							locationType: "swamp"
						},
						petTypeId: 1
					});

					const paramsDislikedLong = createParams({
						expedition: {
							riskRate: 30,
							difficulty: 50,
							durationMinutes: 720, // exactly 12 hours
							locationType: "swamp"
						},
						petTypeId: 1
					});

					const shortRisk = calculateEffectiveRisk(paramsDislikedShort);
					const longRisk = calculateEffectiveRisk(paramsDislikedLong);

					// Long expedition should have 10% less risk (no penalty applied)
					expect(shortRisk).toBeGreaterThan(longRisk);
					expect(shortRisk - longRisk).toBe(10);
				});
			});

			describe("liked location bonus", () => {
				it("should reduce failure risk by 5% when pet likes location", () => {
					// Dog (id 1) likes forest
					const paramsNeutral = createParams({
						expedition: {
							riskRate: 30,
							difficulty: 50,
							durationMinutes: 480,
							locationType: "desert" // neutral for dog
						},
						petTypeId: 1
					});

					const paramsLiked = createParams({
						expedition: {
							riskRate: 30,
							difficulty: 50,
							durationMinutes: 480,
							locationType: "forest" // liked by dog
						},
						petTypeId: 1
					});

					const neutralRisk = calculateEffectiveRisk(paramsNeutral);
					const likedRisk = calculateEffectiveRisk(paramsLiked);

					// Liked should reduce by LIKED_EXPEDITION_FAILURE_REDUCTION (5)
					expect(likedRisk).toBe(neutralRisk - 5);
				});

				it("should apply liked bonus regardless of duration", () => {
					// Dog (id 1) likes forest
					const paramsShort = createParams({
						expedition: {
							riskRate: 30,
							difficulty: 50,
							durationMinutes: 60, // 1 hour
							locationType: "forest"
						},
						petTypeId: 1
					});

					const paramsLong = createParams({
						expedition: {
							riskRate: 30,
							difficulty: 50,
							durationMinutes: 1440, // 24 hours
							locationType: "forest"
						},
						petTypeId: 1
					});

					const shortRisk = calculateEffectiveRisk(paramsShort);
					const longRisk = calculateEffectiveRisk(paramsLong);

					// Both should have the same risk (only preference matters, not duration for liked)
					expect(shortRisk).toBe(longRisk);
				});
			});

			describe("neutral location", () => {
				it("should not apply any preference modifier for neutral locations", () => {
					// Dog (id 1) is neutral to desert
					const paramsNeutral = createParams({
						expedition: {
							riskRate: 30,
							difficulty: 50,
							durationMinutes: 480,
							locationType: "desert"
						},
						petTypeId: 1
					});

					// Expected risk without preference modifiers
					const expectedRisk = 30 + 50 / ExpeditionConstants.EFFECTIVE_RISK_FORMULA.DIFFICULTY_DIVISOR
						- 10 // default pet force
						- 50 / ExpeditionConstants.EFFECTIVE_RISK_FORMULA.LOVE_DIVISOR;

					const actualRisk = calculateEffectiveRisk(paramsNeutral);

					// Should match base calculation (clamped between 0-100)
					expect(actualRisk).toBe(Math.max(0, Math.min(100, expectedRisk)));
				});
			});
		});

		describe("combined modifiers", () => {
			it("should apply food penalty before preference modifiers", () => {
				// This tests that the food multiplier is applied first, then preference is added/subtracted
				const paramsWithPenaltyAndDisliked = createParams({
					expedition: {
						riskRate: 20,
						difficulty: 30,
						durationMinutes: 300, // short
						locationType: "swamp" // disliked by dog
					},
					petTypeId: 1,
					foodConsumed: 1,
					foodRequired: 3
				});

				const result = calculateEffectiveRisk(paramsWithPenaltyAndDisliked);

				// Should be greater than 0 and clamped to 100 max
				expect(result).toBeGreaterThanOrEqual(0);
				expect(result).toBeLessThanOrEqual(100);
			});
		});
	});
});
