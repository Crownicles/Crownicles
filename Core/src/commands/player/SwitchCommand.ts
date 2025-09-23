import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Player } from "../../core/database/game/models/Player";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CommandSwitchCancelled,
	CommandSwitchErrorNoItemToSwitch,
	CommandSwitchPacketReq,
	CommandSwitchSuccess
} from "../../../../Lib/src/packets/commands/CommandSwitchPacket";
import {
	InventorySlot, InventorySlots
} from "../../core/database/game/models/InventorySlot";
import { sortPlayerItemList } from "../../core/utils/ItemUtils";
import { ReactionCollectorInstance } from "../../core/utils/ReactionsCollector";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import {
	ReactionCollectorSwitchItem,
	ReactionCollectorSwitchItemCloseReaction,
	ReactionCollectorSwitchItemReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorSwitchItem";
import { MainItem } from "../../data/MainItem";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { SupportItem } from "../../data/SupportItem";


/**
 * Call the switch function and send switch embed
 * @param response
 * @param player
 * @param toEquipItem
 * @param inventorySlots
 */
async function switchItems(
	response: CrowniclesPacket[],
	player: Player,
	toEquipItem: InventorySlot,
	inventorySlots: InventorySlot[]
): Promise<void> {
	const toBackItem = inventorySlots.filter(slot => slot.isEquipped() && slot.itemCategory === toEquipItem.itemCategory)[0];
	await InventorySlots.switchItemSlots(player, toEquipItem, toBackItem);

	const toBackItemInstance = toBackItem.getItem();
	const toEquipItemInstance = toEquipItem.getItem();

	response.push(makePacket(CommandSwitchSuccess, {
		itemBackedUp: toBackItemInstance instanceof MainItem
			? toBackItemInstance.getDisplayPacket(toBackItem.itemLevel, toBackItem.itemEnchantmentId, player.getMaxStatsValue())
			: (toBackItemInstance as SupportItem).getDisplayPacket(player.getMaxStatsValue()),
		itemEquipped: toEquipItemInstance instanceof MainItem
			? toEquipItemInstance.getDisplayPacket(toEquipItem.itemLevel, toEquipItem.itemEnchantmentId, player.getMaxStatsValue())
			: (toEquipItemInstance as SupportItem).getDisplayPacket(player.getMaxStatsValue())
	}));
}

function getEndCallbackSwitchItems(player: Player, profileSlots: InventorySlot[], toSwitchItems: InventorySlot[]) {
	return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.SWITCH);
		const selectedEmote = collector.getFirstReaction();
		if (!selectedEmote || selectedEmote.reaction.type === ReactionCollectorSwitchItemCloseReaction.name) {
			response.push(makePacket(CommandSwitchCancelled, {}));
			return;
		}
		const toEquipItem = toSwitchItems[(selectedEmote.reaction.data as ReactionCollectorSwitchItemReaction).itemIndex];
		await switchItems(response, player, toEquipItem, profileSlots);
	};
}

export default class SwitchCommand {
	/**
	 * Switch the equipped item with another one
	 * @param response
	 * @param player
	 * @param _packet
	 * @param context
	 */
	@commandRequires(CommandSwitchPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD_OR_JAILED,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandSwitchPacketReq, context: PacketContext): Promise<void> {
		const profileSlots = await InventorySlots.getOfPlayer(player.id);

		// Get the items that can be switched or send an error if none
		let toSwitchItems = profileSlots.filter(slot => !slot.isEquipped() && slot.itemId !== 0);
		if (toSwitchItems.length === 0) {
			response.push(makePacket(CommandSwitchErrorNoItemToSwitch, {}));
			return;
		}

		if (toSwitchItems.length === 1) {
			await switchItems(response, player, toSwitchItems[0], profileSlots);
			return;
		}

		toSwitchItems = sortPlayerItemList(toSwitchItems);

		const collector = new ReactionCollectorSwitchItem(toSwitchItems.map((item: InventorySlot) => {
			const itemInstance = item.getItem();
			if (itemInstance instanceof MainItem) {
				return itemInstance.getDisplayPacket(item.itemLevel, item.itemEnchantmentId, player.getMaxStatsValue());
			}
			else if (itemInstance instanceof SupportItem) {
				return itemInstance.getDisplayPacket(player.getMaxStatsValue());
			}
			throw new Error("Item instance is null");
		}));

		// Create a reaction collector which will let the player choose the mission he wants to skip
		const packet = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId]
			},
			getEndCallbackSwitchItems(player, profileSlots, toSwitchItems)
		)
			.block(player.keycloakId, BlockingConstants.REASONS.SWITCH)
			.build();

		response.push(packet);
	}
}

