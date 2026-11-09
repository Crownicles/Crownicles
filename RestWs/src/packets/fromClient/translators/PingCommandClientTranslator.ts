import { fromClientTranslator } from "../FromClientTranslator";
import { CommandPingPacketReq } from "../../../../../Lib/src/packets/commands/CommandPingPacket";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { PingReq } from "../../../../../WsPackets/src/fromClient/PingReq";

export default class PingCommandClientTranslator {
	@fromClientTranslator(PingReq)
	public static translate(_context: PacketContext, packet: PingReq): Promise<CommandPingPacketReq> {
		return asyncMakePacket(CommandPingPacketReq, {
			time: packet.time
		});
	}
}
