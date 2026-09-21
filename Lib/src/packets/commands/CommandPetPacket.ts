import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { OwnedPet } from "../../types/OwnedPet";
import { ExpeditionLocationType } from "../../constants/ExpeditionConstants";
import { PetPower } from "../../types/PetPower";

/**
 * Data for an expedition in progress, used in /pet display
 */
export interface PetExpeditionInfo {
	endTime: number;
	startTime: number;
	riskRate: number;
	difficulty: number;
	locationType: ExpeditionLocationType;
	mapLocationId: number;
	foodConsumed: number;
	isDistantExpedition?: boolean;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandPetPowersPacketReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetPowersPacketRes extends CrowniclesPacket {
	powers!: PetPower[];
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
	 * When the pet is hungry again, as an absolute timestamp, so the front can refuse a meal before it is asked for.
	 */
	feedAvailableAt?: number;

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

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetCaressPacketRes extends CrowniclesPacket {
}
