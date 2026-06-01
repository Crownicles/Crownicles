import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventLimogesPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventLimogesPacket";
import { limogesResult } from "../../../smallEvents/limoges";

export default class LimogesSmallEventHandler {
	@packetHandler(SmallEventLimogesPacket)
	async smallEventLimoges(context: PacketContext, packet: SmallEventLimogesPacket): Promise<void> {
		await limogesResult(packet, context);
	}
}
