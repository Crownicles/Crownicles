import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { ItemRefusePacket } from "../../../../../Lib/src/packets/events/ItemRefusePacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { ItemRefusedRes } from "../../../../../WsPackets/src/fromServer/inventory/ItemRefusedRes";
import { fromServerTranslator } from "../FromServerTranslator";
import { ItemFoundPacket } from "../../../../../Lib/src/packets/events/ItemFoundPacket";
import { ItemFoundRes } from "../../../../../WsPackets/src/fromServer/inventory/ItemFoundRes";

export default class ItemServerTranslator {
	@fromServerTranslator(ItemFoundPacket, ItemFoundRes)
	public static found(_context: PacketContext, packet: ItemFoundPacket): Promise<ItemFoundRes> {
		return asyncMakeFromServerPacket(ItemFoundRes, {
			item: packet.itemWithDetails,
			kept: packet.kept
		});
	}

	@fromServerTranslator(ItemRefusePacket, ItemRefusedRes)
	public static refused(_context: PacketContext, packet: ItemRefusePacket): Promise<ItemRefusedRes> {
		return asyncMakeFromServerPacket(ItemRefusedRes, {
			item: packet.item,
			autoSell: packet.autoSell,
			soldMoney: packet.soldMoney
		});
	}
}
