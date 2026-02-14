import {
	generateRandomItem, giveItemToPlayer
} from "../utils/ItemUtils";
import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventFindItemPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventFindItemPacket";
import {
	ItemConstants, ItemRarity
} from "../../../../Lib/src/constants/ItemConstants";

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnContinent,
	executeSmallEvent: async (response, player, context): Promise<void> => {
		const itemGenerated = generateRandomItem({
			maxRarity: ItemRarity.EPIC
		});
		await giveItemToPlayer(response, context, player, itemGenerated, { itemLevel: ItemConstants.generateRandomLootLevel() });
		response.push(makePacket(SmallEventFindItemPacket, {}));
	}
};
