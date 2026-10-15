import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import { FightParticipant } from "../../../../WsPackets/src/objects/Fight";
import { resolvePlayerName } from "./PlayerDisplay";

type FighterIdentity = {
	keycloakId?: string; monsterId?: string;
};

export async function fightParticipant(context: PacketContext, fighter: FighterIdentity): Promise<FightParticipant> {
	const name = fighter.keycloakId ? await resolvePlayerName(fighter.keycloakId) : null;
	return {
		isSelf: Boolean(fighter.keycloakId && fighter.keycloakId === context.keycloakId),
		...name ? { name } : {},
		...fighter.monsterId ? { monsterId: fighter.monsterId } : {}
	};
}
