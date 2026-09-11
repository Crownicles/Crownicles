import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandEquipActionReq, CommandEquipPacketReq
} from "../../../../../Lib/src/packets/commands/CommandEquipPacket";
import {
	ItemCategory, ItemConstants
} from "../../../../../Lib/src/constants/ItemConstants";
import { EquipReq } from "../../../../../WsPackets/src/fromClient/EquipReq";
import { EquipActionReq } from "../../../../../WsPackets/src/fromClient/EquipActionReq";
import { fromClientTranslator } from "../FromClientTranslator";
import { InvalidClientPacketError } from "../InvalidClientPacketError";

const ITEM_CATEGORIES = new Set([
	ItemCategory.WEAPON,
	ItemCategory.ARMOR,
	ItemCategory.POTION,
	ItemCategory.OBJECT
]);

function validateEquipAction(packet: EquipActionReq): void {
	if (!Object.values(ItemConstants.EQUIP_ACTIONS).includes(packet.action)) {
		throw new InvalidClientPacketError("Invalid equip action");
	}
	if (!ITEM_CATEGORIES.has(packet.itemCategory)) {
		throw new InvalidClientPacketError("Invalid item category");
	}
	if (!Number.isSafeInteger(packet.slot) || packet.slot < 0) {
		throw new InvalidClientPacketError("Invalid inventory slot");
	}
	if (packet.action === ItemConstants.EQUIP_ACTIONS.EQUIP && packet.slot === 0) {
		throw new InvalidClientPacketError("Cannot equip the active slot");
	}
}

export default class EquipCommandClientTranslator {
	@fromClientTranslator(EquipReq)
	public static open(_context: PacketContext, _packet: EquipReq): Promise<CommandEquipPacketReq> {
		return asyncMakePacket(CommandEquipPacketReq, {});
	}

	@fromClientTranslator(EquipActionReq)
	public static action(_context: PacketContext, packet: EquipActionReq): Promise<CommandEquipActionReq> {
		validateEquipAction(packet);
		return asyncMakePacket(CommandEquipActionReq, {
			action: packet.action,
			itemCategory: packet.itemCategory,
			slot: packet.slot
		});
	}
}
