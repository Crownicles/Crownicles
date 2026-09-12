import { ReactionCollectorCreationPacket } from "../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ReactionCollectorGuildKickData } from "../../../../../Lib/src/packets/interaction/ReactionCollectorGuildKick";
import { ReactionCollectorGuildElderData } from "../../../../../Lib/src/packets/interaction/ReactionCollectorGuildElder";
import { ReactionCollectorGuildElderRemoveData } from "../../../../../Lib/src/packets/interaction/ReactionCollectorGuildElderRemove";
import { ReactionCollectorGuildLeaveData } from "../../../../../Lib/src/packets/interaction/ReactionCollectorGuildLeave";
import { ReactionCollectorCreation } from "../../../../../WsPackets/src/fromServer/common/ReactionCollectorCreation";
import { GUILD_DATA_KINDS } from "../../../../../WsPackets/src/fromServer/collectors";
import { mapCollectorCreation } from "./ReactionCollectorMapper";
import { resolvePlayerName } from "../PlayerDisplay";

const MEMBER_FIELDS = new Map([
	[ReactionCollectorGuildKickData.name, "kickedKeycloakId"],
	[ReactionCollectorGuildElderData.name, "promotedKeycloakId"],
	[ReactionCollectorGuildElderRemoveData.name, "demotedKeycloakId"],
	[ReactionCollectorGuildLeaveData.name, "newChiefKeycloakId"]
]);

export async function mapCollectorDisplay(packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorCreation> {
	const mapped = mapCollectorCreation(packet);
	const field = MEMBER_FIELDS.get(packet.data.type);
	if (!field) {
		return mapped;
	}
	const keycloakId: unknown = Reflect.get(packet.data.data, field);
	const memberName = typeof keycloakId === "string" ? await resolvePlayerName(keycloakId) : null;
	if (memberName && (mapped.data.type === GUILD_DATA_KINDS.MEMBER || mapped.data.type === GUILD_DATA_KINDS.LEAVE)) {
		mapped.data.data.memberName = memberName;
	}
	return mapped;
}
