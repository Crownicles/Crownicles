import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandMissionsPacketReq } from "../../../../../Lib/src/packets/commands/CommandMissionsPacket";
import { MissionsReq } from "../../../../../WsPackets/src/fromClient/MissionsReq";
import { resolveAskedPlayer } from "../AskedPlayerResolver";

export default class MissionsCommandClientTranslator {
	@fromClientTranslator(MissionsReq)
	public static translate(context: PacketContext, packet: MissionsReq): Promise<CommandMissionsPacketReq> {
		return asyncMakePacket(CommandMissionsPacketReq, { askedPlayer: resolveAskedPlayer(context, packet.askedPlayer) });
	}
}
