import { fromClientTranslator } from "../FromClientTranslator";
import { ProfileReq } from "../../../@types/protobufs-client";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandProfilePacketReq } from "../../../../../Lib/src/packets/commands/CommandProfilePacket";

export default class ProfileCommandClientTranslator {
	@fromClientTranslator(ProfileReq)
	public static translate(_context: PacketContext, proto: ProfileReq): Promise<CommandProfilePacketReq> {
		return asyncMakePacket(CommandProfilePacketReq, {
			askedPlayer: {
				rank: proto.askedPlayer.keycloakId ? undefined : proto.askedPlayer.rank ?? undefined,
				keycloakId: proto.askedPlayer.keycloakId ?? undefined
			}
		});
	}
}
