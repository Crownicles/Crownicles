import { fromClientTranslator } from "../FromClientTranslator";
import { PingReq } from "../../../@types/protobufs-client";
import { CommandPingPacketReq } from "../../../../../Lib/src/packets/commands/CommandPingPacket";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";

export default class PingCommandClientTranslator {
	@fromClientTranslator(PingReq)
	public static translate(_context: PacketContext, proto: PingReq): Promise<CommandPingPacketReq> {
		return asyncMakePacket(CommandPingPacketReq, {
			time: proto.time
		});
	}
}
