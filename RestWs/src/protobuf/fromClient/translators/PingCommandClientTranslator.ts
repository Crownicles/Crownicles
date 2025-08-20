import { fromClientTranslator } from "../FromClientTranslator";
import { PingReq } from "../../../@types/protobufs-client";
import { CommandPingPacketReq } from "../../../../../Lib/src/packets/commands/CommandPingPacket";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";

export default class PingCommandClientTranslator {
	@fromClientTranslator(PingReq)
	public static translate(_context: PacketContext, _proto: PingReq): Promise<CommandPingPacketReq> {
		return asyncMakePacket(CommandPingPacketReq, {
			time: Date.now()
		});
	}
}
