import { AsyncPacketSender } from "../../../Lib/src/packets/AsyncPacketSender";
import {
	CrowniclesPacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";

type SendToCore = (context: PacketContext, packet: CrowniclesPacket) => void;

/** Asks Core something outside of any WebSocket, the answer coming back to the caller instead of a player. */
export class AsyncCorePacketSender extends AsyncPacketSender {
	public constructor(private readonly send: SendToCore) {
		super();
	}

	protected sendPacket(context: PacketContext, packet: CrowniclesPacket): Promise<void> {
		this.send(context, packet);
		return Promise.resolve();
	}
}
