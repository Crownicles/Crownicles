import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandReportScrapDealerRecycleRes } from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { ItemRecycleRes } from "../../../../../WsPackets/src/fromServer/report/ItemRecycleRes";

export default class ItemRecycleServerTranslator {
	@fromServerTranslator(CommandReportScrapDealerRecycleRes, ItemRecycleRes)
	public static recycle(_context: PacketContext, packet: CommandReportScrapDealerRecycleRes): Promise<ItemRecycleRes> {
		return asyncMakeFromServerPacket(ItemRecycleRes, {
			itemId: packet.itemId,
			itemCategory: packet.itemCategory,
			itemLevel: packet.itemLevel,
			materials: packet.materialLoot.map(material => ({
				materialId: material.materialId, quantity: material.quantity
			})),
			moneyGained: packet.moneyGained
		});
	}
}
