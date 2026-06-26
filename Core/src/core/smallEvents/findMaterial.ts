import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import { MaterialDataController } from "../../data/Material";
import { Materials } from "../database/game/models/Material";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventFindMaterialPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventFindMaterialPacket";

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted(player): boolean {
		return Maps.isOnContinent(player) || Maps.isOnPveIsland(player);
	},
	executeSmallEvent: async (response, player): Promise<void> => {
		const mapType = player.getDestination()?.type ?? player.getPreviousMap()?.type ?? ExpeditionConstants.DEFAULT_MAP_TYPE;
		const expeditionType = ExpeditionConstants.MAP_TYPE_TO_EXPEDITION_TYPE[mapType]
			?? ExpeditionConstants.MAP_TYPE_TO_EXPEDITION_TYPE[ExpeditionConstants.DEFAULT_MAP_TYPE];
		const materialType = RandomUtils.crowniclesRandom.pick(SmallEventConstants.FIND_MATERIAL.BIOME_MATERIAL_TYPES[expeditionType]);

		const randomNumber = RandomUtils.crowniclesRandom.realZeroToOneInclusive();
		const materialRarity = randomNumber < SmallEventConstants.FIND_MATERIAL.RARE_PROBABILITY
			? MaterialRarity.RARE
			: randomNumber < SmallEventConstants.FIND_MATERIAL.RARE_PROBABILITY + SmallEventConstants.FIND_MATERIAL.UNCOMMON_PROBABILITY
				? MaterialRarity.UNCOMMON
				: MaterialRarity.COMMON;

		const material = MaterialDataController.instance.getRandomMaterialFromTypeAndRarity(materialType, materialRarity)
			?? MaterialDataController.instance.getRandomMaterialFromRarity(materialRarity);

		if (!material) {
			throw new Error(`No material found for rarity ${MaterialRarity[materialRarity]}`);
		}

		const quantity = RandomUtils.rangedInt(SmallEventConstants.FIND_MATERIAL.QUANTITY);

		await Materials.giveMaterial(player.id, parseInt(material.id, 10), quantity);

		response.push(makePacket(SmallEventFindMaterialPacket, {
			materialId: material.id,
			materialRarity: material.rarity,
			materialType: material.type,
			quantity
		}));
	}
};
