import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import { AskedPlayer } from "../../../../WsPackets/src/objects/AskedPlayer";

/**
 * Resolves the player targeted by a client request.
 * An empty asked player means the client asks about itself, so it falls back on the authenticated user.
 * @param context
 * @param askedPlayer
 */
export function resolveAskedPlayer(context: PacketContext, askedPlayer: AskedPlayer): AskedPlayer {
	if (askedPlayer.keycloakId) {
		return { keycloakId: askedPlayer.keycloakId };
	}

	if (askedPlayer.rank) {
		return { rank: askedPlayer.rank };
	}

	return { keycloakId: context.keycloakId };
}
