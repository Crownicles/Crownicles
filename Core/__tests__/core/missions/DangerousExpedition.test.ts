import { describe, it, expect } from "vitest";
import { missionInterface } from "../../../src/core/missions/interfaces/dangerousExpedition";
import { MissionDifficulty } from "../../../src/core/missions/MissionDifficulty";

describe("dangerousExpedition mission", () => {
	describe("areParamsMatchingVariantAndBlob", () => {
		describe("veryLow category (0-15)", () => {
			it("should return true when riskRate is at category boundary (15) and variant is veryLow max (15)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(15, { riskRate: 15 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return true when riskRate is within veryLow (10) and variant is veryLow max (15)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(15, { riskRate: 10 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return false when riskRate is veryLow (10) and variant is low (30)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(30, { riskRate: 10 }, null as unknown as Buffer);
				expect(result).toBe(false);
			});
		});

		describe("low category (16-30)", () => {
			it("should return true when riskRate is low (25) and variant is low max (30)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(30, { riskRate: 25 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return true when riskRate is low (30) and variant is veryLow (15)", () => {
				// Higher category should match lower category variant
				const result = missionInterface.areParamsMatchingVariantAndBlob(15, { riskRate: 30 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return false when riskRate is low (20) and variant is medium (50)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(50, { riskRate: 20 }, null as unknown as Buffer);
				expect(result).toBe(false);
			});
		});

		describe("medium category (31-50)", () => {
			it("should return true when riskRate is medium (45) and variant is medium max (50)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(50, { riskRate: 45 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return true when riskRate is medium (50) and variant is low (30)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(30, { riskRate: 50 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return false when riskRate is medium (35) and variant is high (70)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(70, { riskRate: 35 }, null as unknown as Buffer);
				expect(result).toBe(false);
			});
		});

		describe("high category (51-70)", () => {
			it("should return true when riskRate is high (65) and variant is high max (70)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(70, { riskRate: 65 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return true when riskRate is high (70) and variant is medium (50)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(50, { riskRate: 70 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return false when riskRate is high (55) and variant is veryHigh (100)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(100, { riskRate: 55 }, null as unknown as Buffer);
				expect(result).toBe(false);
			});
		});

		describe("veryHigh category (71-100)", () => {
			it("should return true when riskRate is veryHigh (85) and variant is veryHigh (100)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(100, { riskRate: 85 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return true when riskRate is veryHigh (100) and variant is high (70)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(70, { riskRate: 100 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});

			it("should return true when riskRate is veryHigh (71) and variant is low (30)", () => {
				const result = missionInterface.areParamsMatchingVariantAndBlob(30, { riskRate: 71 }, null as unknown as Buffer);
				expect(result).toBe(true);
			});
		});

		describe("category boundary edge cases", () => {
			it("should correctly categorize riskRate at veryLow/low boundary (15 vs 16)", () => {
				// 15 is veryLow, 16 is low
				// Variant 15 (veryLow), riskRate 16 (low) should match (low >= veryLow)
				expect(missionInterface.areParamsMatchingVariantAndBlob(15, { riskRate: 16 }, null as unknown as Buffer)).toBe(true);
				// Variant 16 (low), riskRate 15 (veryLow) should not match (veryLow < low)
				expect(missionInterface.areParamsMatchingVariantAndBlob(16, { riskRate: 15 }, null as unknown as Buffer)).toBe(false);
			});

			it("should correctly categorize riskRate at low/medium boundary (30 vs 31)", () => {
				// 30 is low, 31 is medium
				expect(missionInterface.areParamsMatchingVariantAndBlob(30, { riskRate: 31 }, null as unknown as Buffer)).toBe(true);
				expect(missionInterface.areParamsMatchingVariantAndBlob(31, { riskRate: 30 }, null as unknown as Buffer)).toBe(false);
			});

			it("should correctly categorize riskRate at medium/high boundary (50 vs 51)", () => {
				// 50 is medium, 51 is high
				expect(missionInterface.areParamsMatchingVariantAndBlob(50, { riskRate: 51 }, null as unknown as Buffer)).toBe(true);
				expect(missionInterface.areParamsMatchingVariantAndBlob(51, { riskRate: 50 }, null as unknown as Buffer)).toBe(false);
			});

			it("should correctly categorize riskRate at high/veryHigh boundary (70 vs 71)", () => {
				// 70 is high, 71 is veryHigh
				expect(missionInterface.areParamsMatchingVariantAndBlob(70, { riskRate: 71 }, null as unknown as Buffer)).toBe(true);
				expect(missionInterface.areParamsMatchingVariantAndBlob(71, { riskRate: 70 }, null as unknown as Buffer)).toBe(false);
			});
		});
	});

	describe("generateRandomVariant", () => {
		it("should return 30 for EASY difficulty", () => {
			const result = missionInterface.generateRandomVariant(MissionDifficulty.EASY);
			expect(result).toBe(30);
		});

		it("should return 50 for MEDIUM difficulty", () => {
			const result = missionInterface.generateRandomVariant(MissionDifficulty.MEDIUM);
			expect(result).toBe(50);
		});

		it("should return 70 for HARD difficulty", () => {
			const result = missionInterface.generateRandomVariant(MissionDifficulty.HARD);
			expect(result).toBe(70);
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
