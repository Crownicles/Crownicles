import {
	commandRequires,
	CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket,
	makePacket,
	PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import {
	CommandDepositCancelPacket,
	CommandDepositCannotDepositPacket,
	CommandDepositNoItemPacket,
	CommandDepositPacketReq, CommandDepositSuccessPacket
} from "../../../../Lib/src/packets/commands/CommandDepositPacket";
import {
	InventorySlot,
	InventorySlots
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

type DepositCandidate = {
	slot: InventorySlot;
	freeSlot: number;
};

async function getDepositCandidates(
	player: Player,
	equippedItems: InventorySlot[]
): Promise<DepositCandidate[]> {
	const slotChecks = await Promise.all(
		equippedItems.map(async slot => {
			const freeSlot = await InventorySlots.getNextFreeSlotForItemCategory(
				player,
				slot.itemCategory
			);
			if (!freeSlot) {
				return null;
			}
			return {
				slot,
				freeSlot
			};
		})
	);

	return slotChecks.filter(
		(entry): entry is DepositCandidate => entry !== null
	);
}

async function deposeItem(response: CrowniclesPacket[], player: Player, itemToDeposit: DepositCandidate): Promise<void> {
	await InventorySlots.deposeItem(player, itemToDeposit);
	response.push(makePacket(CommandDepositSuccessPacket, {
		item: (itemToDeposit.slot.getItem() as MainItem | ObjectItem).getDisplayPacket()
	}));
}

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

function manageMoreThanOneItemToDeposit(response: CrowniclesPacket[], context: PacketContext, player: Player, depositCandidates: DepositCandidate[]): void {
	const collector = new ReactionCollectorDeposeItem(depositCandidates.map((item: DepositCandidate) => (item.slot.getItem() as MainItem | ObjectItem).getDisplayPacket()));


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

		const depositCandidates = await getDepositCandidates(player, equippedItems);

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
