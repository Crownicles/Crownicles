import { describe, it, expect } from "vitest";
import { missionInterface } from "../../../src/core/missions/interfaces/collectMaterials";
import { MissionDifficulty } from "../../../src/core/missions/MissionDifficulty";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";

describe("collectMaterials mission", () => {
	describe("generateRandomVariant", () => {
		it("should map EASY difficulty to the common rarity threshold", () => {
			expect(missionInterface.generateRandomVariant(MissionDifficulty.EASY, null as never)).toBe(MaterialRarity.COMMON);
		});

		it("should map MEDIUM difficulty to the uncommon rarity threshold", () => {
			expect(missionInterface.generateRandomVariant(MissionDifficulty.MEDIUM, null as never)).toBe(MaterialRarity.UNCOMMON);
		});

		it("should map HARD difficulty to the rare rarity threshold", () => {
			expect(missionInterface.generateRandomVariant(MissionDifficulty.HARD, null as never)).toBe(MaterialRarity.RARE);
		});
	});

	describe("areParamsMatchingVariantAndBlob", () => {
		it("should match when the material rarity is exactly the variant threshold", () => {
			expect(missionInterface.areParamsMatchingVariantAndBlob(MaterialRarity.UNCOMMON, { rarity: MaterialRarity.UNCOMMON }, null as unknown as Buffer)).toBe(true);
		});

		it("should match when the material rarity is above the variant threshold", () => {
			expect(missionInterface.areParamsMatchingVariantAndBlob(MaterialRarity.UNCOMMON, { rarity: MaterialRarity.RARE }, null as unknown as Buffer)).toBe(true);
		});

		it("should not match when the material rarity is below the variant threshold", () => {
			expect(missionInterface.areParamsMatchingVariantAndBlob(MaterialRarity.RARE, { rarity: MaterialRarity.COMMON }, null as unknown as Buffer)).toBe(false);
		});
	});
});
