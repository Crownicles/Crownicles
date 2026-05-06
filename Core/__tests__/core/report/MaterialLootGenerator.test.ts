import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";

// Mock RandomUtils.crowniclesRandom.realZeroToOneInclusive so we can control rolls
const realZeroToOneInclusiveMock = vi.fn();
vi.mock("../../../../Lib/src/utils/RandomUtils", () => ({
	RandomUtils: {
		crowniclesRandom: {
			realZeroToOneInclusive: () => realZeroToOneInclusiveMock()
		}
	}
}));

// Mock MaterialDataController so we don't depend on real material data
const getRandomMaterialFromRarityMock = vi.fn();
vi.mock("../../../src/data/Material", () => ({
	MaterialDataController: {
		instance: {
			getRandomMaterialFromRarity: (rarity: MaterialRarity) => getRandomMaterialFromRarityMock(rarity)
		}
	}
}));

// Import after mocks so the module under test picks up the mocked deps
const { pickMaterialDistribution, pickRarityFromRoll } = await import("../../../src/core/report/MaterialLootGenerator");

const fakeMaterial = (id: string) => ({ id });

describe("pickRarityFromRoll", () => {
	// Default constants: RARE_PROBABILITY = 0.1, UNCOMMON_PROBABILITY = 0.3
	it("returns RARE for rolls strictly below RARE_PROBABILITY", () => {
		expect(pickRarityFromRoll(0)).toBe(MaterialRarity.RARE);
		expect(pickRarityFromRoll(0.05)).toBe(MaterialRarity.RARE);
		expect(pickRarityFromRoll(0.0999999)).toBe(MaterialRarity.RARE);
	});

	it("returns UNCOMMON at the RARE boundary and within the uncommon band", () => {
		expect(pickRarityFromRoll(0.1)).toBe(MaterialRarity.UNCOMMON); // boundary belongs to UNCOMMON
		expect(pickRarityFromRoll(0.25)).toBe(MaterialRarity.UNCOMMON);
		expect(pickRarityFromRoll(0.3999)).toBe(MaterialRarity.UNCOMMON);
	});

	it("returns COMMON at the UNCOMMON boundary and above", () => {
		expect(pickRarityFromRoll(0.4)).toBe(MaterialRarity.COMMON); // boundary belongs to COMMON
		expect(pickRarityFromRoll(0.7)).toBe(MaterialRarity.COMMON);
		expect(pickRarityFromRoll(1)).toBe(MaterialRarity.COMMON);
	});
});

describe("pickMaterialDistribution", () => {
	beforeEach(() => {
		realZeroToOneInclusiveMock.mockReset();
		getRandomMaterialFromRarityMock.mockReset();
	});

	it("returns an empty distribution when totalQuantity is 0", () => {
		const result = pickMaterialDistribution(0);
		expect(result.size).toBe(0);
		expect(realZeroToOneInclusiveMock).not.toHaveBeenCalled();
		expect(getRandomMaterialFromRarityMock).not.toHaveBeenCalled();
	});

	it("rolls totalQuantity times against the rarity ladder", () => {
		realZeroToOneInclusiveMock
			.mockReturnValueOnce(0.05) // RARE
			.mockReturnValueOnce(0.25) // UNCOMMON
			.mockReturnValueOnce(0.7); // COMMON
		getRandomMaterialFromRarityMock.mockImplementation((rarity: MaterialRarity) => {
			if (rarity === MaterialRarity.RARE) {
				return fakeMaterial("100");
			}
			if (rarity === MaterialRarity.UNCOMMON) {
				return fakeMaterial("200");
			}
			return fakeMaterial("300");
		});

		const result = pickMaterialDistribution(3);

		expect(realZeroToOneInclusiveMock).toHaveBeenCalledTimes(3);
		expect(getRandomMaterialFromRarityMock).toHaveBeenNthCalledWith(1, MaterialRarity.RARE);
		expect(getRandomMaterialFromRarityMock).toHaveBeenNthCalledWith(2, MaterialRarity.UNCOMMON);
		expect(getRandomMaterialFromRarityMock).toHaveBeenNthCalledWith(3, MaterialRarity.COMMON);
		expect(result.get(100)).toBe(1);
		expect(result.get(200)).toBe(1);
		expect(result.get(300)).toBe(1);
		expect(result.size).toBe(3);
	});

	it("aggregates duplicate material ids into a single entry with summed quantity", () => {
		realZeroToOneInclusiveMock
			.mockReturnValueOnce(0.7)
			.mockReturnValueOnce(0.8)
			.mockReturnValueOnce(0.9)
			.mockReturnValueOnce(0.95)
			.mockReturnValueOnce(0.99);
		getRandomMaterialFromRarityMock.mockReturnValue(fakeMaterial("42"));

		const result = pickMaterialDistribution(5);

		expect(result.size).toBe(1);
		expect(result.get(42)).toBe(5);
	});

	it("silently skips drops when the rarity pool is empty", () => {
		realZeroToOneInclusiveMock
			.mockReturnValueOnce(0.05) // RARE -> empty
			.mockReturnValueOnce(0.25) // UNCOMMON -> empty
			.mockReturnValueOnce(0.7); // COMMON -> material 7
		getRandomMaterialFromRarityMock.mockImplementation((rarity: MaterialRarity) => {
			if (rarity === MaterialRarity.COMMON) {
				return fakeMaterial("7");
			}
			return null;
		});

		const result = pickMaterialDistribution(3);

		expect(result.size).toBe(1);
		expect(result.get(7)).toBe(1);
	});

	it("returns an empty distribution when every pool is empty", () => {
		realZeroToOneInclusiveMock
			.mockReturnValueOnce(0.05)
			.mockReturnValueOnce(0.25)
			.mockReturnValueOnce(0.7);
		getRandomMaterialFromRarityMock.mockReturnValue(null);

		const result = pickMaterialDistribution(3);

		expect(result.size).toBe(0);
		expect(getRandomMaterialFromRarityMock).toHaveBeenCalledTimes(3);
	});

	it("respects the rarity ladder boundaries (deterministic distribution)", () => {
		// 10 rolls: 1 < 0.1 (rare), 3 in [0.1, 0.4) (uncommon), 6 >= 0.4 (common)
		const rolls = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
		for (const r of rolls) {
			realZeroToOneInclusiveMock.mockReturnValueOnce(r);
		}
		const counts = { rare: 0, uncommon: 0, common: 0 };
		getRandomMaterialFromRarityMock.mockImplementation((rarity: MaterialRarity) => {
			if (rarity === MaterialRarity.RARE) {
				counts.rare++;
				return fakeMaterial("1");
			}
			if (rarity === MaterialRarity.UNCOMMON) {
				counts.uncommon++;
				return fakeMaterial("2");
			}
			counts.common++;
			return fakeMaterial("3");
		});

		const result = pickMaterialDistribution(rolls.length);

		expect(counts).toEqual({ rare: 1, uncommon: 3, common: 6 });
		expect(result.get(1)).toBe(1);
		expect(result.get(2)).toBe(3);
		expect(result.get(3)).toBe(6);
	});
});
