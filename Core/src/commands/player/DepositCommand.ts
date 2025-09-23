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

async function deposeItem(response: CrowniclesPacket[], player: Player, itemToDeposit: InventorySlot): Promise<void> {
	await InventorySlot.deposeItem(player, itemToDeposit);
	response.push(makePacket(CommandDepositSuccessPacket, {
		item: (itemToDeposit.getItem() as MainItem | ObjectItem).getDisplayPacket()
	}));
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



		if (itemsThatCanBeDeposited.length === 0) {
			response.push(makePacket(CommandDepositCannotDepositPacket, {}));
			return;
		}

		if (itemsThatCanBeDeposited.length === 1) {
			await deposeItem(response, player, itemsThatCanBeDeposited[0], invSlots);
			return;
		}
	}
}
