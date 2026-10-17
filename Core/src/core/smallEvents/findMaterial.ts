import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { TravelTime } from "../maps/TravelTime";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
import { Biome } from "../../../../Lib/src/types/Biome";
import { BiomeDataController } from "../../data/Biome";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import {
	Material, MaterialDataController
} from "../../data/Material";
import { Materials } from "../database/game/models/Material";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventFindMaterialPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventFindMaterialPacket";
import { Player } from "../database/game/models/Player";
import { updateCollectMaterialsMission } from "../utils/MaterialLootUtils";

/**
 * Pick the biome to loot from: it blends the origin and destination maps, the destination being
 * more likely the further along the trip the player is. Falls back to the plains biome when the map is unknown.
 */
export function pickTravelBiome(player: Player): Biome {
	const mapLocation = RandomUtils.crowniclesRandom.realZeroToOneInclusive() < TravelTime.getTravelProgress(player)
		? player.getDestination()
		: player.getPreviousMap();
	return mapLocation?.pickBiome() ?? ExpeditionConstants.EXPEDITION_LOCATION_TYPES.PLAINS;
}

/**
 * Roll the rarity of the looted material following the find material probability ladder.
 */
function rollMaterialRarity(): MaterialRarity {
	const randomNumber = RandomUtils.crowniclesRandom.realZeroToOneInclusive();
	if (randomNumber < SmallEventConstants.FIND_MATERIAL.RARE_PROBABILITY) {
		return MaterialRarity.RARE;
	}
	if (randomNumber < SmallEventConstants.FIND_MATERIAL.RARE_PROBABILITY + SmallEventConstants.FIND_MATERIAL.UNCOMMON_PROBABILITY) {
		return MaterialRarity.UNCOMMON;
	}
	return MaterialRarity.COMMON;
}

/**
 * Pick a material of the given rarity from the loot table of the biome
 */
export function pickMaterialFromBiome(biome: Biome, rarity: MaterialRarity): Material {
	const candidates = BiomeDataController.instance.getMaterialLoot(biome)
		.map(materialId => MaterialDataController.instance.getById(String(materialId)))
		.filter((material): material is Material => material?.rarity === rarity);
	if (candidates.length === 0) {
		throw new Error(`No ${MaterialRarity[rarity]} material in the ${biome} loot table`);
	}
	return RandomUtils.crowniclesRandom.pick(candidates);
}

/**
 * Roll the looted quantity, with a small chance to multiply the haul for a lucky jackpot.
 */
function rollQuantity(): number {
	const quantity = RandomUtils.rangedInt(SmallEventConstants.FIND_MATERIAL.QUANTITY);
	if (RandomUtils.crowniclesRandom.realZeroToOneInclusive() < SmallEventConstants.FIND_MATERIAL.LUCKY_MULTIPLIER.PROBABILITY) {
		return quantity * RandomUtils.rangedInt(SmallEventConstants.FIND_MATERIAL.LUCKY_MULTIPLIER);
	}
	return quantity;
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted(player): boolean {
		return Maps.isOnContinent(player);
	},
	executeSmallEvent: async (response, player): Promise<void> => {
		const material = pickMaterialFromBiome(pickTravelBiome(player), rollMaterialRarity());
		const quantity = rollQuantity();

		await Materials.giveMaterial(player.id, parseInt(material.id, 10), quantity);

		await updateCollectMaterialsMission(player, response, [
			{
				materialId: parseInt(material.id, 10),
				quantity
			}
		]);

		response.push(makePacket(SmallEventFindMaterialPacket, {
			materialId: material.id,
			materialRarity: material.rarity,
			materialType: material.type,
			quantity
		}));
	}
};
