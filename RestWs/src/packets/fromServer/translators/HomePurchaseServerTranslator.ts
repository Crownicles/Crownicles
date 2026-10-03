import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportApartmentBuyRes, CommandReportBuyHomeRes, CommandReportMoveHomeRes, CommandReportNotEnoughMoneyRes, CommandReportUpgradeHomeRes
} from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	HOME_PURCHASES, HomePurchaseRes
} from "../../../../../WsPackets/src/fromServer/home/HomePurchaseRes";
import { NotEnoughMoneyRes } from "../../../../../WsPackets/src/fromServer/common/NotEnoughMoneyRes";

export default class HomePurchaseServerTranslator {
	@fromServerTranslator(CommandReportNotEnoughMoneyRes, NotEnoughMoneyRes)
	public static notEnoughMoney(_context: PacketContext, packet: CommandReportNotEnoughMoneyRes): Promise<NotEnoughMoneyRes> {
		return asyncMakeFromServerPacket(NotEnoughMoneyRes, { missingMoney: packet.missingMoney });
	}

	@fromServerTranslator(CommandReportBuyHomeRes, HomePurchaseRes)
	public static buy(_context: PacketContext, packet: CommandReportBuyHomeRes): Promise<HomePurchaseRes> {
		return asyncMakeFromServerPacket(HomePurchaseRes, {
			purchase: HOME_PURCHASES.HOME, cost: packet.cost, homeLevel: packet.level
		});
	}

	@fromServerTranslator(CommandReportUpgradeHomeRes, HomePurchaseRes)
	public static upgrade(_context: PacketContext, packet: CommandReportUpgradeHomeRes): Promise<HomePurchaseRes> {
		return asyncMakeFromServerPacket(HomePurchaseRes, {
			purchase: HOME_PURCHASES.UPGRADE, cost: packet.cost, homeLevel: packet.level
		});
	}

	@fromServerTranslator(CommandReportMoveHomeRes, HomePurchaseRes)
	public static move(_context: PacketContext, packet: CommandReportMoveHomeRes): Promise<HomePurchaseRes> {
		return asyncMakeFromServerPacket(HomePurchaseRes, {
			purchase: HOME_PURCHASES.MOVE, cost: packet.cost, homeLevel: packet.level
		});
	}

	@fromServerTranslator(CommandReportApartmentBuyRes, HomePurchaseRes)
	public static apartment(_context: PacketContext, packet: CommandReportApartmentBuyRes): Promise<HomePurchaseRes> {
		return asyncMakeFromServerPacket(HomePurchaseRes, {
			purchase: HOME_PURCHASES.APARTMENT, cost: packet.cost, mapLocationId: packet.mapLocationId, isRented: packet.isRented
		});
	}
}
