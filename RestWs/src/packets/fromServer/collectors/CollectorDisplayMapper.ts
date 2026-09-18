import { ReactionCollectorCreationPacket } from "../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorPetSellData } from "../../../../../Lib/src/packets/interaction/ReactionCollectorPetSell";
import { ReactionCollectorGuildKickData } from "../../../../../Lib/src/packets/interaction/ReactionCollectorGuildKick";
import { ReactionCollectorGuildElderData } from "../../../../../Lib/src/packets/interaction/ReactionCollectorGuildElder";
import { ReactionCollectorGuildElderRemoveData } from "../../../../../Lib/src/packets/interaction/ReactionCollectorGuildElderRemove";
import { ReactionCollectorGuildLeaveData } from "../../../../../Lib/src/packets/interaction/ReactionCollectorGuildLeave";
import { ReactionCollectorCreation } from "../../../../../WsPackets/src/fromServer/common/ReactionCollectorCreation";
import {
	GUILD_DATA_KINDS, PET_MANAGEMENT_DATA_KINDS, PLAYER_UTILITY_DATA_KINDS, ReactionCollectorDataOf
} from "../../../../../WsPackets/src/fromServer/collectors";
import {
	PET_SALE_ROLES, PetSaleRole
} from "../../../../../WsPackets/src/objects/PetManagement";
import { mapCollectorCreation } from "./ReactionCollectorMapper";
import { resolvePlayerName } from "../PlayerDisplay";
import { ReactionCollectorUnlockData } from "../../../../../Lib/src/packets/interaction/ReactionCollectorUnlock";

const MEMBER_FIELDS = new Map([
	[ReactionCollectorGuildKickData.name, "kickedKeycloakId"],
	[ReactionCollectorGuildElderData.name, "promotedKeycloakId"],
	[ReactionCollectorGuildElderRemoveData.name, "demotedKeycloakId"],
	[ReactionCollectorGuildLeaveData.name, "newChiefKeycloakId"]
]);

function saleRole(source: ReactionCollectorPetSellData, context?: PacketContext): PetSaleRole {
	if (!context?.keycloakId) {
		return PET_SALE_ROLES.OBSERVER;
	}
	if (source.sellerKeycloakId === context.keycloakId) {
		return PET_SALE_ROLES.SELLER;
	}
	return source.buyerKeycloakId === context.keycloakId ? PET_SALE_ROLES.BUYER : PET_SALE_ROLES.OBSERVER;
}

async function saleDisplay(data: ReactionCollectorDataOf<typeof PET_MANAGEMENT_DATA_KINDS.SELL>, source: ReactionCollectorPetSellData, context?: PacketContext): Promise<void> {
	data.data.role = saleRole(source, context);
	const sellerName = await resolvePlayerName(source.sellerKeycloakId);
	const buyerName = source.buyerKeycloakId ? await resolvePlayerName(source.buyerKeycloakId) : null;
	if (sellerName) {
		data.data.sellerName = sellerName;
	}
	if (buyerName) {
		data.data.buyerName = buyerName;
	}
}

async function memberDisplay(data: ReactionCollectorDataOf<typeof GUILD_DATA_KINDS.MEMBER | typeof GUILD_DATA_KINDS.LEAVE>, packet: ReactionCollectorCreationPacket): Promise<void> {
	const field = MEMBER_FIELDS.get(packet.data.type);
	if (!field) {
		return;
	}
	const keycloakId: unknown = Reflect.get(packet.data.data, field);
	const memberName = typeof keycloakId === "string" ? await resolvePlayerName(keycloakId) : null;
	if (memberName) {
		data.data.memberName = memberName;
	}
}

export async function mapCollectorDisplay(packet: ReactionCollectorCreationPacket, context?: PacketContext): Promise<ReactionCollectorCreation> {
	const mapped = mapCollectorCreation(packet);
	switch (mapped.data.type) {
		case PLAYER_UTILITY_DATA_KINDS.UNLOCK: {
			const source = packet.data.data as ReactionCollectorUnlockData;
			const playerName = await resolvePlayerName(source.unlockedKeycloakId);
			if (playerName) {
				mapped.data.data.playerName = playerName;
			}
			break;
		}
		case PET_MANAGEMENT_DATA_KINDS.SELL:
			await saleDisplay(mapped.data, packet.data.data as ReactionCollectorPetSellData, context);
			break;
		case GUILD_DATA_KINDS.MEMBER:
		case GUILD_DATA_KINDS.LEAVE:
			await memberDisplay(mapped.data, packet);
			break;
		default:
			break;
	}
	return mapped;
}
