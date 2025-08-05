import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandProfilePacketReq } from "../../../../../Lib/src/packets/commands/CommandProfilePacket";
import { ProfileReq } from "../../../../../WsPackets/src/fromClient/ProfileReq";

export default class ProfileCommandClientTranslator {
	@fromClientTranslator(ProfileReq)
	public static translate(_context: PacketContext, packet: ProfileReq): Promise<CommandProfilePacketReq> {
		return asyncMakePacket(CommandProfilePacketReq, {
			askedPlayer: {
				rank: packet.askedPlayer.keycloakId ? undefined : packet.askedPlayer.rank ?? undefined,
				keycloakId: packet.askedPlayer.keycloakId ?? undefined
			}
		});
	}
}
