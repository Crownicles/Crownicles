import {
	afterEach, describe, expect, it, vi
} from "vitest";
import {
	pickMaterialFromBiome, pickTravelBiome
} from "../../../src/core/smallEvents/findMaterial";
import { BiomeDataController } from "../../../src/data/Biome";
import { MapLocation } from "../../../src/data/MapLocation";
import { TravelTime } from "../../../src/core/maps/TravelTime";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import { Biome } from "../../../../Lib/src/types/Biome";
import Player from "../../../src/core/database/game/models/Player";

const DRAWS_PER_CASE = 20;

function travellingPlayer(previousBiome: Biome, destination: MapLocation | null): Player {
	return {
		getPreviousMap: () => Object.assign(new MapLocation(), { biomes: [previousBiome] }),
		getDestination: () => destination
	} as Player;
}

describe("find material small event biome loot", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("only draws materials of the rolled rarity from the loot table of the biome", () => {
		for (const biome of Object.values(ExpeditionConstants.EXPEDITION_LOCATION_TYPES)) {
			const loot = BiomeDataController.instance.getMaterialLoot(biome);
			for (const rarity of [MaterialRarity.COMMON, MaterialRarity.UNCOMMON, MaterialRarity.RARE]) {
				for (let i = 0; i < DRAWS_PER_CASE; i++) {
					const material = pickMaterialFromBiome(biome, rarity);

					expect(loot).toContain(parseInt(material.id, 10));
					expect(material.rarity).toBe(rarity);
				}
			}
		}
	});

	it("loots in the destination biome near the end of the trip", () => {
		vi.spyOn(TravelTime, "getTravelProgress").mockReturnValue(0.8);
		vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(0.5);
		const destination = Object.assign(new MapLocation(), { biomes: [ExpeditionConstants.EXPEDITION_LOCATION_TYPES.CAVE] });

		expect(pickTravelBiome(travellingPlayer(ExpeditionConstants.EXPEDITION_LOCATION_TYPES.COAST, destination)))
			.toBe(ExpeditionConstants.EXPEDITION_LOCATION_TYPES.CAVE);
	});

	it("loots in the departure biome near the start of the trip", () => {
		vi.spyOn(TravelTime, "getTravelProgress").mockReturnValue(0.2);
		vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(0.5);
		const destination = Object.assign(new MapLocation(), { biomes: [ExpeditionConstants.EXPEDITION_LOCATION_TYPES.CAVE] });

		expect(pickTravelBiome(travellingPlayer(ExpeditionConstants.EXPEDITION_LOCATION_TYPES.COAST, destination)))
			.toBe(ExpeditionConstants.EXPEDITION_LOCATION_TYPES.COAST);
	});

	it("falls back to the plains biome when the map is unknown", () => {
		vi.spyOn(TravelTime, "getTravelProgress").mockReturnValue(0.8);
		vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(0.5);

		expect(pickTravelBiome(travellingPlayer(ExpeditionConstants.EXPEDITION_LOCATION_TYPES.COAST, null)))
			.toBe(ExpeditionConstants.EXPEDITION_LOCATION_TYPES.PLAINS);
	});
});
