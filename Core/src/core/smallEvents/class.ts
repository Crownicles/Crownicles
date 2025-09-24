import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { ClassDataController } from "../../data/Class";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { SmallEventClassPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventClassPacket";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import {
	ItemCategory, ItemNature
} from "../../../../Lib/src/constants/ItemConstants";
import {
	generateRandomItem, giveItemToPlayer
} from "../utils/ItemUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../database/game/models/Player";
import { ClassKind } from "../../../../Lib/src/types/ClassKind";
import { PlayerActiveObjects } from "../database/game/models/PlayerActiveObjects";

/**
 * Manage the different interactions
 * @param player
 * @param playerActiveObjects
 * @param packet
 * @param response
 * @param context
 * @param classKind
 */
async function managePickedInteraction(
	player: Player,
	playerActiveObjects: PlayerActiveObjects,
	packet: SmallEventClassPacket,
	response: CrowniclesPacket[],
	context: PacketContext,
	classKind: ClassKind
): Promise<void> {
	let item;

	switch (packet.interactionName) {
		case ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS_NAMES.WIN_WEAPON:
			item = generateRandomItem({
				itemCategory: ItemCategory.WEAPON
			});
			break;

		case ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS_NAMES.WIN_ARMOR:
			item = generateRandomItem({
				itemCategory: ItemCategory.ARMOR
			});
			break;

		case ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS_NAMES.WIN_OBJECT:
			item = generateRandomItem({
				itemCategory: ItemCategory.OBJECT,
				subType: classKind === ClassConstants.CLASS_KIND.ATTACK ? ItemNature.ATTACK : ItemNature.DEFENSE
			});
			break;

		case ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS_NAMES.WIN_ITEM:
			item = generateRandomItem({});
			break;

		case ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS_NAMES.WIN_POTION:
			item = generateRandomItem({
				itemCategory: ItemCategory.POTION,
				subType: classKind === ClassConstants.CLASS_KIND.ATTACK ? ItemNature.ATTACK : ItemNature.DEFENSE
			});
			break;

		case ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS_NAMES.WIN_HEALTH:
			packet.amount = RandomUtils.rangedInt(SmallEventConstants.CLASS.HEALTH);
			await player.addHealth(packet.amount, response, NumberChangeReason.SMALL_EVENT, playerActiveObjects);
			break;

		case ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS_NAMES.WIN_MONEY:
			packet.amount = RandomUtils.rangedInt(SmallEventConstants.CLASS.MONEY);
			await player.addMoney({
				amount: packet.amount,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});
			break;
		default:
			break;
	}
	if (item) {
		await giveItemToPlayer(response, context, player, item);
	}
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnContinent,
	executeSmallEvent: async (response, player, context, playerActiveObjects): Promise<void> => {
		const playerClassId = player.class;
		const classKind = ClassDataController.instance.getById(playerClassId).classKind;
		const issue = RandomUtils.crowniclesRandom.pick(ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS[classKind.toUpperCase() as keyof typeof ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS]);
		const packet: SmallEventClassPacket = {
			classKind,
			interactionName: issue
		};
		await managePickedInteraction(player, playerActiveObjects, packet, response, context, classKind);
		response.unshift(makePacket(SmallEventClassPacket, packet));
	}
};
