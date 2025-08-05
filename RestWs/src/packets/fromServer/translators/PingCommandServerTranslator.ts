import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandPingPacketRes } from "../../../../../Lib/src/packets/commands/CommandPingPacket";
import { PingRes } from "../../../../../WsPackets/src/fromServer/ping/PingRes";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";

export default class PingCommandServerTranslator {
	@fromServerTranslator(CommandPingPacketRes, PingRes)
	public static translate(_context: PacketContext, packet: CommandPingPacketRes): Promise<PingRes> {
		return asyncMakeFromServerPacket(PingRes, {
			time: packet.clientTime
		});
	}
}
