import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { BaseMission } from "../../types/CompletedMission";
import { PetDiet } from "../../constants/PetConstants";
import { SexTypeShort } from "../../constants/StringConstants";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandMissionShopPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionShopAlreadyBoughtPointsThisWeek extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionShopMoney extends CrowniclesPacket {
	amount!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionShopKingsFavor extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionShopPetInformation extends CrowniclesPacket {
	nickname!: string;

	petId!: number;

	typeId!: number;

	sex!: SexTypeShort;

	loveLevel!: number;

	lovePoints!: number;

	diet!: PetDiet;

	nextFeed!: number;

	fightAssistId!: string;

	ageCategory!: string;

	force!: number;

	speed!: number;

	feedDelay!: number;

	/**
	 * Expedition location types that this pet likes (e.g., "forest", "mountain")
	 */
	likedExpeditionTypes?: string[];

	/**
	 * Expedition location types that this pet dislikes (e.g., "desert", "swamp")
	 */
	dislikedExpeditionTypes?: string[];

	randomPetDwarf?: {
		typeId: number;
		sex: SexTypeShort;
		numberOfPetsNotSeen: number;
	};
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionShopSkipMissionResult extends CrowniclesPacket {
	oldMission!: BaseMission;

	newMission!: BaseMission;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionShopBadge extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionShopNoMissionToSkip extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionShopAlreadyHadBadge extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionShopNoPet extends CrowniclesPacket {
}
