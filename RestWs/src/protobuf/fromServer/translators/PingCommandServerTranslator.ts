import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandPingPacketRes } from "../../../../../Lib/src/packets/commands/CommandPingPacket";
import { PingRes } from "../../../@types/protobufs-server";

export default class PingCommandServerTranslator {
	@fromServerTranslator(CommandPingPacketRes, PingRes)
	public static translate(_context: PacketContext, packet: CommandPingPacketRes): Promise<PingRes> {
		return Promise.resolve(PingRes.create({
			time: packet.clientTime
		}));
	}
}
