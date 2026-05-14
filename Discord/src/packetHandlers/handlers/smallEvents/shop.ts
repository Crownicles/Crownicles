import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	SmallEventShopAcceptPacket,
	SmallEventShopCannotBuyPacket,
	SmallEventShopRefusePacket
} from "../../../../../Lib/src/packets/smallEvents/SmallEventShopPacket";
import { baseFunctionHandler } from "../../../smallEvents/shop";

export default class ShopSmallEventHandler {
	@packetHandler(SmallEventShopRefusePacket)
	async smallEventShopRefuse(context: PacketContext, _packet: SmallEventShopRefusePacket): Promise<void> {
		await baseFunctionHandler(context, "smallEvents:shop.refused");
	}


	@packetHandler(SmallEventShopAcceptPacket)
	async smallEventShopAccept(context: PacketContext, _packet: SmallEventShopAcceptPacket): Promise<void> {
		await baseFunctionHandler(context, "smallEvents:shop.purchased");
	}


	@packetHandler(SmallEventShopCannotBuyPacket)
	async smallEventShopCannotBuy(context: PacketContext, _packet: SmallEventShopCannotBuyPacket): Promise<void> {
		await baseFunctionHandler(context, "smallEvents:shop.notEnoughMoney");
	}
}
