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
	CommandDepositPacketReq
} from "../../../../Lib/src/packets/commands/CommandDepositPacket";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";

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

		const itemsThatCanBeDeposited = equippedItems.filter(equippedItem =>
			invSlots.some(slot =>
				!slot.isEquipped()
				&& slot.itemCategory === equippedItem.itemCategory));

		if (itemsThatCanBeDeposited.length === 0) {
			response.push(makePacket(CommandDepositCannotDepositPacket, {}));
			return;
		}
	}
}
