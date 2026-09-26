import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { ItemRefusePacket } from "../../../../../Lib/src/packets/events/ItemRefusePacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { ItemRefusedRes } from "../../../../../WsPackets/src/fromServer/inventory/ItemRefusedRes";
import { fromServerTranslator } from "../FromServerTranslator";

export default class ItemServerTranslator {
	@fromServerTranslator(ItemRefusePacket, ItemRefusedRes)
	public static refused(_context: PacketContext, packet: ItemRefusePacket): Promise<ItemRefusedRes> {
		return asyncMakeFromServerPacket(ItemRefusedRes, {
			item: packet.item,
			autoSell: packet.autoSell,
			soldMoney: packet.soldMoney
		});
	}
}
