import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandProfilePacketReq } from "../../../../../Lib/src/packets/commands/CommandProfilePacket";
import {
	PlayerProfileReq, ProfileReq
} from "../../../../../WsPackets/src/fromClient/ProfileReq";
import { resolveAskedPlayer } from "../AskedPlayerResolver";
import { referencedKeycloakId } from "../../../services/PlayerReference";

export default class ProfileCommandClientTranslator {
	@fromClientTranslator(ProfileReq)
	public static translate(context: PacketContext, packet: ProfileReq): Promise<CommandProfilePacketReq> {
		return asyncMakePacket(CommandProfilePacketReq, { askedPlayer: resolveAskedPlayer(context, packet.askedPlayer) });
	}

	@fromClientTranslator(PlayerProfileReq)
	public static other(_context: PacketContext, packet: PlayerProfileReq): Promise<CommandProfilePacketReq> {
		return asyncMakePacket(CommandProfilePacketReq, { askedPlayer: { keycloakId: referencedKeycloakId(packet.playerRef) } });
	}
}
