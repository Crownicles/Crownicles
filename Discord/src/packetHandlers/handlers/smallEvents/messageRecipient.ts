import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventMessageRecipientPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventMessageRecipientPacket";
import { messageRecipientResult } from "../../../smallEvents/messageRecipient";

export default class MessageRecipientSmallEventHandler {
	@packetHandler(SmallEventMessageRecipientPacket)
	async smallEventMessageRecipient(context: PacketContext, packet: SmallEventMessageRecipientPacket): Promise<void> {
		await messageRecipientResult(context, packet);
	}
}
