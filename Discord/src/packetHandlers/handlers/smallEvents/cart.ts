import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventCartPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventCartPacket";
import { cartResult } from "../../../smallEvents/cart";

export default class CartSmallEventHandler {
	@packetHandler(SmallEventCartPacket)
	async smallEventCart(context: PacketContext, packet: SmallEventCartPacket): Promise<void> {
		await cartResult(packet, context);
	}
}
