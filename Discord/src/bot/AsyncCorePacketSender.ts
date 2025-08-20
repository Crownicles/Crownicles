import { AsyncPacketSender } from "../../../Lib/src/packets/AsyncPacketSender";
import {
	CrowniclesPacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import { PacketUtils } from "../utils/PacketUtils";

export class AsyncCorePacketSender extends AsyncPacketSender {
	protected sendPacket(context: PacketContext, packet: CrowniclesPacket): Promise<void> {
		PacketUtils.sendPacketToBackend(context, packet);
		return Promise.resolve();
	}
}
