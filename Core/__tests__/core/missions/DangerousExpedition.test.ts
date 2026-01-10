import { describe, it, expect } from "vitest";
import { missionInterface } from "../../../src/core/missions/interfaces/dangerousExpedition";
import { MissionDifficulty } from "../../../src/core/missions/MissionDifficulty";

describe("dangerousExpedition mission", () => {
	describe("areParamsMatchingVariantAndBlob", () => {
		/**
		 * New 8-category system:
		 * trivial (0-10), veryLow (11-20), low (21-32), moderate (33-45),
		 * high (46-58), veryHigh (59-72), extreme (73-86), desperate (87-100)
		 */

		describe("trivial category (0-10)", () => {
			it("should return true when riskRate is at category boundary (10) and variant is trivial max (10)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(10, { riskRate: 10 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return true when riskRate is within trivial (5) and variant is trivial max (10)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(10, { riskRate: 5 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return false when riskRate is trivial (5) and variant is veryLow (20)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(20, { riskRate: 5 }, null as unknown as Buffer);
				expect(result).toBe(false);
			});
		});

		describe("veryLow category (11-20)", () => {
			it("should return true when riskRate is veryLow (15) and variant is veryLow max (20)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(20, { riskRate: 15 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return true when riskRate is veryLow (20) and variant is trivial (10)", () => {
				// Higher category should match lower category variant
				const result = missionInterface.areParamsMatchingVariantAndBlob(10, { riskRate: 20 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return false when riskRate is veryLow (15) and variant is low (32)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(32, { riskRate: 15 }, null as unknown as Buffer);
				expect(result).toBe(false);
			});
		});

		describe("low category (21-32)", () => {
			it("should return true when riskRate is low (25) and variant is low max (32)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(32, { riskRate: 25 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return true when riskRate is low (32) and variant is veryLow (20)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(20, { riskRate: 32 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return false when riskRate is low (25) and variant is moderate (45)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(45, { riskRate: 25 }, null as unknown as Buffer);
				expect(result).toBe(false);
			});
		});

		describe("moderate category (33-45)", () => {
			it("should return true when riskRate is moderate (40) and variant is moderate max (45)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(45, { riskRate: 40 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return true when riskRate is moderate (45) and variant is low (32)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(32, { riskRate: 45 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return false when riskRate is moderate (40) and variant is high (58)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(58, { riskRate: 40 }, null as unknown as Buffer);
				expect(result).toBe(false);
			});
		});

		describe("high category (46-58)", () => {
			it("should return true when riskRate is high (50) and variant is high max (58)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(58, { riskRate: 50 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return true when riskRate is high (58) and variant is moderate (45)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(45, { riskRate: 58 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return false when riskRate is high (50) and variant is veryHigh (72)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(72, { riskRate: 50 }, null as unknown as Buffer);
				expect(result).toBe(false);
			});
		});

		describe("veryHigh category (59-72)", () => {
			it("should return true when riskRate is veryHigh (65) and variant is veryHigh max (72)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(72, { riskRate: 65 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return true when riskRate is veryHigh (72) and variant is high (58)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(58, { riskRate: 72 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return false when riskRate is veryHigh (65) and variant is extreme (86)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(86, { riskRate: 65 }, null as unknown as Buffer);
				expect(result).toBe(false);
			});
		});

		describe("extreme category (73-86)", () => {
			it("should return true when riskRate is extreme (80) and variant is extreme max (86)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(86, { riskRate: 80 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return true when riskRate is extreme (86) and variant is veryHigh (72)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(72, { riskRate: 86 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return false when riskRate is extreme (80) and variant is desperate (100)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(100, { riskRate: 80 }, null as unknown as Buffer);
				expect(result).toBe(false);
			});
		});

		describe("desperate category (87-100)", () => {
			it("should return true when riskRate is desperate (95) and variant is desperate max (100)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(100, { riskRate: 95 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return true when riskRate is desperate (100) and variant is extreme (86)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(86, { riskRate: 100 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return true when riskRate is desperate (87) and variant is low (32)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(32, { riskRate: 87 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});
		});

		describe("category boundary edge cases", () => {
			it("should correctly categorize riskRate at trivial/veryLow boundary (10 vs 11)", () => {
				// 10 is trivial, 11 is veryLow
				expect(missionInterface.areParamsMatchingVariantAndBlob(10, { riskRate: 11 }, null as unknown as Buffer)).toBe(true);
				expect(missionInterface.areParamsMatchingVariantAndBlob(11, { riskRate: 10 }, null as unknown as Buffer)).toBe(false);
			});

			it("should correctly categorize riskRate at veryLow/low boundary (20 vs 21)", () => {
				// 20 is veryLow, 21 is low
				expect(missionInterface.areParamsMatchingVariantAndBlob(20, { riskRate: 21 }, null as unknown as Buffer)).toBe(true);
				expect(missionInterface.areParamsMatchingVariantAndBlob(21, { riskRate: 20 }, null as unknown as Buffer)).toBe(false);
			});

			it("should correctly categorize riskRate at low/moderate boundary (32 vs 33)", () => {
				// 32 is low, 33 is moderate
				expect(missionInterface.areParamsMatchingVariantAndBlob(32, { riskRate: 33 }, null as unknown as Buffer)).toBe(true);
				expect(missionInterface.areParamsMatchingVariantAndBlob(33, { riskRate: 32 }, null as unknown as Buffer)).toBe(false);
			});

			it("should correctly categorize riskRate at moderate/high boundary (45 vs 46)", () => {
				// 45 is moderate, 46 is high
				expect(missionInterface.areParamsMatchingVariantAndBlob(45, { riskRate: 46 }, null as unknown as Buffer)).toBe(true);
				expect(missionInterface.areParamsMatchingVariantAndBlob(46, { riskRate: 45 }, null as unknown as Buffer)).toBe(false);
			});

			it("should correctly categorize riskRate at high/veryHigh boundary (58 vs 59)", () => {
				// 58 is high, 59 is veryHigh
				expect(missionInterface.areParamsMatchingVariantAndBlob(58, { riskRate: 59 }, null as unknown as Buffer)).toBe(true);
				expect(missionInterface.areParamsMatchingVariantAndBlob(59, { riskRate: 58 }, null as unknown as Buffer)).toBe(false);
			});

			it("should correctly categorize riskRate at veryHigh/extreme boundary (72 vs 73)", () => {
				// 72 is veryHigh, 73 is extreme
				expect(missionInterface.areParamsMatchingVariantAndBlob(72, { riskRate: 73 }, null as unknown as Buffer)).toBe(true);
				expect(missionInterface.areParamsMatchingVariantAndBlob(73, { riskRate: 72 }, null as unknown as Buffer)).toBe(false);
			});

			it("should correctly categorize riskRate at extreme/desperate boundary (86 vs 87)", () => {
				// 86 is extreme, 87 is desperate
				expect(missionInterface.areParamsMatchingVariantAndBlob(86, { riskRate: 87 }, null as unknown as Buffer)).toBe(true);
				expect(missionInterface.areParamsMatchingVariantAndBlob(87, { riskRate: 86 }, null as unknown as Buffer)).toBe(false);
			});
		});
	});

	describe("generateRandomVariant", () => {
		it("should return 45 for EASY difficulty (moderate risk)", () => {
			const result = missionInterface.generateRandomVariant(MissionDifficulty.EASY);
			expect(result).toBe(45);
		});

		it("should return 58 for MEDIUM difficulty (high risk)", () => {
			const result = missionInterface.generateRandomVariant(MissionDifficulty.MEDIUM);
			expect(result).toBe(58);
		});

		it("should return 72 for HARD difficulty (veryHigh risk)", () => {
			const result = missionInterface.generateRandomVariant(MissionDifficulty.HARD);
			expect(result).toBe(72);
		});
	});

	describe("initialNumberDone", () => {
		it("should return 0", () => {
			const result = missionInterface.initialNumberDone();
			expect(result).toBe(0);
		});
	});

	describe("updateSaveBlob", () => {
		it("should return null (no state tracking needed)", () => {
			const result = missionInterface.updateSaveBlob(0, null as unknown as Buffer, { riskRate: 50 });
			expect(result).toBeNull();
		});
	});
});
