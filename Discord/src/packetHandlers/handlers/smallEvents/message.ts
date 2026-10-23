import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventMessagePacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventMessagePacket";
import { messageHandler } from "../../../smallEvents/message";

export default class MessageSmallEventHandler {
	@packetHandler(SmallEventMessagePacket)
	async smallEventMessage(context: PacketContext, packet: SmallEventMessagePacket): Promise<void> {
		await messageHandler(context, packet);
	}
}
