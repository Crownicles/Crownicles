import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { OwnedPet } from "../../types/OwnedPet";
import { ExpeditionLocationType } from "../../constants/ExpeditionConstants";

/**
 * Data for an expedition in progress, used in /pet display
 */
export interface PetExpeditionInfo {
	endTime: number;
	riskRate: number;
	locationType: ExpeditionLocationType;
	mapLocationId: number;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandPetPacketReq extends CrowniclesPacket {
	askedPlayer!: {
		rank?: number;
		keycloakId?: string;
	};
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetPacketRes extends CrowniclesPacket {
	askedKeycloakId?: string | null;

	pet!: OwnedPet;

	/**
	 * Whether the player has the Talisman of Anchorage (can use expeditions)
	 */
	hasTalisman?: boolean;

	/**
	 * Current expedition in progress, if any
	 */
	expeditionInProgress?: PetExpeditionInfo;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetPetNotFound extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandPetCaressPacketReq extends CrowniclesPacket {
}
