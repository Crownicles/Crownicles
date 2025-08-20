import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import {
	generateRandomItem, giveItemToPlayer
} from "../utils/ItemUtils";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventFindPotionPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventFindPotionPacket";

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnContinent,
	executeSmallEvent: async (response, player, context): Promise<void> => {
		const potionGenerated = generateRandomItem({
			itemCategory: ItemCategory.POTION
		});
		response.push(makePacket(SmallEventFindPotionPacket, {}));
		await giveItemToPlayer(response, context, player, potionGenerated);
	}
};
