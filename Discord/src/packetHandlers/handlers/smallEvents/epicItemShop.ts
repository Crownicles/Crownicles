import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { epicItemShopHandler } from "../../../smallEvents/epicItemShop";
import {
	SmallEventEpicItemShopAcceptPacket,
	SmallEventEpicItemShopCannotBuyPacket,
	SmallEventEpicItemShopRefusePacket
} from "../../../../../Lib/src/packets/smallEvents/SmallEventEpicItemShopPacket";

export default class EpicItemShopSmallEventHandler {
	@packetHandler(SmallEventEpicItemShopRefusePacket)
	async smallEventEpicItemShopRefuse(context: PacketContext, _packet: SmallEventEpicItemShopRefusePacket): Promise<void> {
		await epicItemShopHandler(context, "smallEvents:epicItemShop.refused");
	}


	@packetHandler(SmallEventEpicItemShopAcceptPacket)
	async smallEventEpicItemShopAccept(context: PacketContext, _packet: SmallEventEpicItemShopAcceptPacket): Promise<void> {
		await epicItemShopHandler(context, "smallEvents:epicItemShop.purchased");
	}


	@packetHandler(SmallEventEpicItemShopCannotBuyPacket)
	async smallEventEpicItemShopCannotBuy(context: PacketContext, _packet: SmallEventEpicItemShopCannotBuyPacket): Promise<void> {
		await epicItemShopHandler(context, "smallEvents:epicItemShop.notEnoughMoney");
	}
}
