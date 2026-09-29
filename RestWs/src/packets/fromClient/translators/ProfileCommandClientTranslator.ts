import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandProfilePacketReq } from "../../../../../Lib/src/packets/commands/CommandProfilePacket";
import {
	PlayerProfileReq, ProfileReq
} from "../../../../../WsPackets/src/fromClient/ProfileReq";
import { resolveAskedPlayer } from "../AskedPlayerResolver";
import { resolvePlayerReference } from "../../../services/PlayerReference";

/** No account bears this identifier, so Core answers that the player does not exist. */
const UNKNOWN_PLAYER = "unknown-player-reference";

export default class ProfileCommandClientTranslator {
	@fromClientTranslator(ProfileReq)
	public static translate(context: PacketContext, packet: ProfileReq): Promise<CommandProfilePacketReq> {
		return asyncMakePacket(CommandProfilePacketReq, { askedPlayer: resolveAskedPlayer(context, packet.askedPlayer) });
	}

	@fromClientTranslator(PlayerProfileReq)
	public static other(_context: PacketContext, packet: PlayerProfileReq): Promise<CommandProfilePacketReq> {
		// A forged or outdated handle must end in "player not found", never fall back on the requester.
		const keycloakId = typeof packet.playerRef === "string" ? resolvePlayerReference(packet.playerRef) : null;
		return asyncMakePacket(CommandProfilePacketReq, { askedPlayer: { keycloakId: keycloakId ?? UNKNOWN_PLAYER } });
	}
}
