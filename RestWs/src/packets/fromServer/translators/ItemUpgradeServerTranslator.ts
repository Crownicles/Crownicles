import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportBlacksmithUpgradeRes, CommandReportRoyalBlacksmithUpgradeRes, CommandReportUpgradeItemRes
} from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { RoyalBlacksmithConstants } from "../../../../../Lib/src/constants/BlacksmithConstants";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	ITEM_UPGRADE_ARTISANS, ItemUpgradeRes
} from "../../../../../WsPackets/src/fromServer/report/ItemUpgradeRes";

export default class ItemUpgradeServerTranslator {
	@fromServerTranslator(CommandReportUpgradeItemRes, ItemUpgradeRes)
	public static home(_context: PacketContext, packet: CommandReportUpgradeItemRes): Promise<ItemUpgradeRes> {
		return asyncMakeFromServerPacket(ItemUpgradeRes, {
			artisan: ITEM_UPGRADE_ARTISANS.HOME, itemId: packet.itemId, itemCategory: packet.itemCategory, itemLevel: packet.newItemLevel, moneySpent: 0
		});
	}

	@fromServerTranslator(CommandReportBlacksmithUpgradeRes, ItemUpgradeRes)
	public static blacksmith(_context: PacketContext, packet: CommandReportBlacksmithUpgradeRes): Promise<ItemUpgradeRes> {
		return asyncMakeFromServerPacket(ItemUpgradeRes, {
			artisan: ITEM_UPGRADE_ARTISANS.BLACKSMITH, itemId: packet.itemId, itemCategory: packet.itemCategory, itemLevel: packet.newItemLevel, moneySpent: packet.totalCost
		});
	}

	@fromServerTranslator(CommandReportRoyalBlacksmithUpgradeRes, ItemUpgradeRes)
	public static royalBlacksmith(_context: PacketContext, packet: CommandReportRoyalBlacksmithUpgradeRes): Promise<ItemUpgradeRes> {
		return asyncMakeFromServerPacket(ItemUpgradeRes, {
			artisan: ITEM_UPGRADE_ARTISANS.ROYAL_BLACKSMITH,
			itemId: packet.itemId,
			itemCategory: packet.itemCategory,
			itemLevel: RoyalBlacksmithConstants.TARGET_LEVEL,
			moneySpent: packet.upgradeCost + packet.materialsCost,
			gemsSpent: packet.gemCost
		});
	}
}
