import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
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
		const randomNumber = RandomUtils.crowniclesRandom.realZeroToOneInclusive();
		const materialRarity = randomNumber < SmallEventConstants.FIND_MATERIAL.RARE_PROBABILITY
			? MaterialRarity.RARE
			: randomNumber < SmallEventConstants.FIND_MATERIAL.RARE_PROBABILITY + SmallEventConstants.FIND_MATERIAL.UNCOMMON_PROBABILITY
				? MaterialRarity.UNCOMMON
				: MaterialRarity.COMMON;

		const material = MaterialDataController.instance.getRandomMaterialFromRarity(materialRarity);

		if (!material) {
			throw new Error(`No material found for rarity ${MaterialRarity[materialRarity]}`);
		}

		await Materials.giveMaterial(player.id, material.id, 1);

		response.push(makePacket(SmallEventFindMaterialPacket, {
			materialId: material.id,
			materialRarity: material.rarity,
			materialType: material.type
		}));
	}
};
