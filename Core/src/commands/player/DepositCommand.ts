import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import {
	CommandDepositCancelPacket,
	CommandDepositCannotDepositPacket,
	CommandDepositNoItemPacket,
	CommandDepositPacketReq,
	CommandDepositSuccessPacket
} from "../../../../Lib/src/packets/commands/CommandDepositPacket";
import {
	InventorySlot, InventorySlots
} from "../../core/database/game/models/InventorySlot";
import { MainItem } from "../../data/MainItem";
import { ObjectItem } from "../../data/ObjectItem";
import { ReactionCollectorInstance } from "../../core/utils/ReactionsCollector";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import {
	ReactionCollectorDeposeItem,
	ReactionCollectorDeposeItemCloseReaction,
	ReactionCollectorDeposeItemReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorDeposeItem";
import { InventoryInfos } from "../../core/database/game/models/InventoryInfo";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";

type DepositCandidate = {
	slot: InventorySlot;
	freeSlot: number;
};

/**
 * Return an array of items that can be deposed in the player's stock
 * @param player
 * @param equippedItems
 * @param playerSlots
 */
async function getDepositCandidates(
	player: Player,
	equippedItems: InventorySlot[],
	playerSlots: InventorySlot[]
): Promise<DepositCandidate[]> {
	const playerInvInfo = await InventoryInfos.getOfPlayer(player.id);

	const slotChecks = equippedItems.map(slot => {
		const limits = playerInvInfo.slotLimitForCategory(slot.itemCategory);
		const sameCategoryItems = playerSlots.filter(
			s => s.itemCategory === slot.itemCategory && s.slot < limits
		);

		let freeSlot: number | null = null;
		for (let i = 0; i < limits; ++i) {
			const occupied = sameCategoryItems.some(s => s.slot === i);
			if (!occupied) {
				freeSlot = i;
				break;
			}
		}

		if (!freeSlot) {
			return null;
		}

		return {
			slot,
			freeSlot
		};
	});

	return slotChecks.filter(
		(entry): entry is DepositCandidate => entry !== null
	);
}

/**
 * Depose the item into the player's stock
 * @param response
 * @param player
 * @param itemToDeposit
 */
async function deposeItem(response: CrowniclesPacket[], player: Player, itemToDeposit: DepositCandidate): Promise<void> {
	await InventorySlots.deposeItem(player, itemToDeposit);
	const item = itemToDeposit.slot.getItem()!;
	const category = item.getCategory();
	response.push(makePacket(CommandDepositSuccessPacket, {
		item: category === ItemCategory.WEAPON || category === ItemCategory.ARMOR
			? (item as MainItem).getDisplayPacket(itemToDeposit.slot.itemLevel, itemToDeposit.slot.itemEnchantmentId ?? undefined)
			: (item as ObjectItem).getDisplayPacket()
	}));
}

/**
 * Manage the callback when the player has more than 1 item to depose
 * @param player
 * @param depositCandidates
 */
function manageMoreThanOneItemToDepositEndCallback(player: Player, depositCandidates: DepositCandidate[]) {
	return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.DEPOSIT);
		const selectedEmote = collector.getFirstReaction();
		if (!selectedEmote || selectedEmote.reaction.type === ReactionCollectorDeposeItemCloseReaction.name) {
			response.push(makePacket(CommandDepositCancelPacket, {}));
			return;
		}
		const toDeposeItem = depositCandidates[(selectedEmote.reaction.data as ReactionCollectorDeposeItemReaction).itemIndex];
		await deposeItem(response, player, toDeposeItem);
	};
}

/**
 * Manage when the player has more than 1 item to depose
 * @param response
 * @param context
 * @param player
 * @param depositCandidates
 */
function manageMoreThanOneItemToDeposit(response: CrowniclesPacket[], context: PacketContext, player: Player, depositCandidates: DepositCandidate[]): void {
	const collector = new ReactionCollectorDeposeItem(depositCandidates.map((item: DepositCandidate) => {
		const itemInstance = item.slot.getItem()!;
		return itemInstance instanceof MainItem
			? (itemInstance as MainItem).getDisplayPacket(item.slot.itemLevel, item.slot.itemEnchantmentId ?? undefined)
			: (itemInstance as ObjectItem).getDisplayPacket();
	}));

	response.push(new ReactionCollectorInstance(
		collector,
		context,
		{
			allowedPlayerKeycloakIds: [player.keycloakId],
			reactionLimit: 1
		},
		manageMoreThanOneItemToDepositEndCallback(player, depositCandidates)
	)
		.block(player.keycloakId, BlockingConstants.REASONS.DEPOSIT)
		.build());
}

export default class DepositCommand {
	/**
	 * Deposit an equipped item in the item's stock.
	 * @param response
	 * @param player
	 * @param _packet
	 * @param context
	 */
	@commandRequires(CommandDepositPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD_OR_JAILED,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandDepositPacketReq, context: PacketContext): Promise<void> {
		const invSlots = await InventorySlots.getOfPlayer(player.id);
		const equippedItems = invSlots.filter(slot => slot.isEquipped() && slot.itemId !== 0);

		if (equippedItems.length === 0) {
			response.push(makePacket(CommandDepositNoItemPacket, {}));
			return;
		}

		const depositCandidates = await getDepositCandidates(player, equippedItems, invSlots);

		if (depositCandidates.length === 0) {
			response.push(makePacket(CommandDepositCannotDepositPacket, {}));
			return;
		}

		if (depositCandidates.length === 1) {
			await deposeItem(response, player, depositCandidates[0]);
			return;
		}

		manageMoreThanOneItemToDeposit(response, context, player, depositCandidates);
	}
}
