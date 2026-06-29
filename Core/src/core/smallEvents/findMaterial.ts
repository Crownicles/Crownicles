import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { TravelTime } from "../maps/TravelTime";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import {
	ExpeditionConstants, ExpeditionLocationType
} from "../../../../Lib/src/constants/ExpeditionConstants";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import { MaterialDataController } from "../../data/Material";
import { Materials } from "../database/game/models/Material";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventFindMaterialPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventFindMaterialPacket";
import { Player } from "../database/game/models/Player";
import { MissionsController } from "../missions/MissionsController";

/**
 * Resolve the expedition biome associated with a map location type, falling back to the default biome.
 */
function getBiomeExpeditionType(mapType: string | undefined): ExpeditionLocationType {
	return ExpeditionConstants.MAP_TYPE_TO_EXPEDITION_TYPE[mapType ?? ExpeditionConstants.DEFAULT_MAP_TYPE]
		?? ExpeditionConstants.MAP_TYPE_TO_EXPEDITION_TYPE[ExpeditionConstants.DEFAULT_MAP_TYPE];
}

/**
 * Compute the travel progress of the player (0 at the start of the trip, 1 once arrived).
 */
function getTravelProgress(player: Player): number {
	const travelData = TravelTime.getTravelDataSimplified(player, new Date());
	const tripDuration = travelData.travelEndTime - travelData.travelStartTime - travelData.effectDuration;
	if (tripDuration <= 0) {
		return 1;
	}
	return Math.min(1, Math.max(0, travelData.playerTravelledTime / tripDuration));
}

/**
 * Pick the biome to loot from: it blends the origin and destination biomes, the destination being
 * more likely the further along the trip the player is.
 */
function pickBiomeExpeditionType(player: Player): ExpeditionLocationType {
	const progress = getTravelProgress(player);
	return RandomUtils.crowniclesRandom.realZeroToOneInclusive() < progress
		? getBiomeExpeditionType(player.getDestination()?.type)
		: getBiomeExpeditionType(player.getPreviousMap()?.type);
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
		return Maps.isOnContinent(player) || Maps.isOnPveIsland(player);
	},
	executeSmallEvent: async (response, player): Promise<void> => {
		const materialType = RandomUtils.crowniclesRandom.pick(SmallEventConstants.FIND_MATERIAL.BIOME_MATERIAL_TYPES[pickBiomeExpeditionType(player)]);
		const materialRarity = rollMaterialRarity();

		const material = MaterialDataController.instance.getRandomMaterialFromTypeAndRarity(materialType, materialRarity)
			?? MaterialDataController.instance.getRandomMaterialFromRarity(materialRarity);

		if (!material) {
			throw new Error(`No material found for rarity ${MaterialRarity[materialRarity]}`);
		}

		const quantity = rollQuantity();

		await Materials.giveMaterial(player.id, parseInt(material.id, 10), quantity);

		await MissionsController.update(player, response, {
			missionId: "collectMaterials",
			count: quantity,
			params: { rarity: materialRarity }
		});

		response.push(makePacket(SmallEventFindMaterialPacket, {
			materialId: material.id,
			materialRarity: material.rarity,
			materialType: material.type,
			quantity
		}));
	}
};
