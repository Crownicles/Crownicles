import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import {
	CommandSellCancelErrorPacket,
	CommandSellItemSuccessPacket,
	CommandSellNoItemErrorPacket,
	CommandSellPacketReq
} from "../../../../Lib/src/packets/commands/CommandSellPacket";
import {
	InventorySlot, InventorySlots
} from "../../core/database/game/models/InventorySlot";
import {
	countNbOfPotions, getItemByIdAndCategory, getItemValue, sortPlayerItemList
} from "../../core/utils/ItemUtils";
import { ReactionCollectorInstance } from "../../core/utils/ReactionsCollector";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import {
	ReactionCollectorSell,
	ReactionCollectorSellItemReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorSell";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { crowniclesInstance } from "../../index";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { MissionsController } from "../../core/missions/MissionsController";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";

function getEndCallback(player: Player) {
	return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.SELL);

		const firstReaction = collector.getFirstReaction();
		if (!firstReaction || firstReaction.reaction.type === ReactionCollectorRefuseReaction.name) {
			response.push(makePacket(CommandSellCancelErrorPacket, {}));
			return;
		}

		const sellItem = firstReaction.reaction.data as ReactionCollectorSellItemReaction;
		const itemInstance = getItemByIdAndCategory(sellItem.item.id, sellItem.item.category);

		crowniclesInstance.logsDatabase.logItemSell(player.keycloakId, itemInstance).then();

		await player.reload();

		// Extra protection to avoid receiving money for an item not deleted. Should not happen, but better safe than sorry.
		if (await InventorySlot.destroy({
			where: {
				itemId: sellItem.item.id,
				playerId: player.id,
				slot: sellItem.slot,
				itemCategory: sellItem.item.category
			}
		}) > 0) {
			await player.addMoney({
				amount: sellItem.price,
				response,
				reason: NumberChangeReason.ITEM_SELL
			});
			await player.save();

			await MissionsController.update(player, response, {
				missionId: "sellItemWithGivenCost",
				params: { itemCost: sellItem.price }
			});
			await MissionsController.update(player, response, {
				missionId: "sellItems"
			});
			await MissionsController.update(player, response, {
				missionId: "havePotions",
				count: countNbOfPotions(await InventorySlots.getOfPlayer(player.id)),
				set: true
			});

			response.push(makePacket(CommandSellItemSuccessPacket, {
				item: sellItem.item,
				price: sellItem.price
			}));
		}
	};
}

export default class SellCommand {
	@commandRequires(CommandSellPacketReq, {
		notBlocked: true,
		whereAllowed: [WhereAllowed.CONTINENT],
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD_OR_JAILED
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandSellPacketReq, context: PacketContext): Promise<void> {
		const invSlots = await InventorySlots.getOfPlayer(player.id);

		let toSellItems = invSlots.filter(slot => !slot.isEquipped() && slot.itemId !== 0);
		if (toSellItems.length === 0) {
			response.push(makePacket(CommandSellNoItemErrorPacket, {}));
			return;
		}

		toSellItems = sortPlayerItemList(toSellItems);

		const collector = new ReactionCollectorSell(
			toSellItems.map(slot => ({
				item: {
					id: slot.itemId,
					category: slot.itemCategory
				},
				slot: slot.slot,
				price: slot.itemCategory === ItemCategory.POTION ? 0 : getItemValue(slot.getItem())
			}))
		);

		const packet = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId]
			},
			getEndCallback(player)
		)
			.block(player.keycloakId, BlockingConstants.REASONS.SELL)
			.build();

		response.push(packet);
	}
}
