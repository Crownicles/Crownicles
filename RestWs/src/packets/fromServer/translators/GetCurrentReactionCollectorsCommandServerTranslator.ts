import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { CommandGetCurrentReactionCollectorsPacketRes } from "../../../../../Lib/src/packets/commands/CommandGetCurrentReactionCollectorsPacket";
import { CommandGetCurrentReactionCollectorsRes } from "../../../../../WsPackets/src/fromServer/getCurrentReactionCollectors/GetCurrentReactionCollectorsRes";

export default class GetCurrentReactionCollectorsCommandServerTranslator {
	@fromServerTranslator(CommandGetCurrentReactionCollectorsPacketRes, CommandGetCurrentReactionCollectorsRes)
	public static translate(_context: PacketContext, packet: CommandGetCurrentReactionCollectorsPacketRes): Promise<CommandGetCurrentReactionCollectorsRes> {
		return asyncMakeFromServerPacket(CommandGetCurrentReactionCollectorsRes, {
			collectors: packet.collectors
		});
	}
}
