import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandProfilePacketReq } from "../../../../../Lib/src/packets/commands/CommandProfilePacket";
import { ProfileReq } from "../../../../../WsPackets/src/fromClient/ProfileReq";
import { resolveAskedPlayer } from "../AskedPlayerResolver";

export default class ProfileCommandClientTranslator {
	@fromClientTranslator(ProfileReq)
	public static translate(context: PacketContext, packet: ProfileReq): Promise<CommandProfilePacketReq> {
		return asyncMakePacket(CommandProfilePacketReq, { askedPlayer: resolveAskedPlayer(context, packet.askedPlayer) });
	}
}
