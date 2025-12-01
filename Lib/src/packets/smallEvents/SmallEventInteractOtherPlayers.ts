import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { SexTypeShort } from "../../constants/StringConstants";

export enum InteractOtherPlayerInteraction {
	TOP1,
	TOP10,
	TOP50,
	TOP100,
	POWERFUL_GUILD,
	STAFF_MEMBER,
	BEGINNER,
	ADVANCED,
	SAME_CLASS,
	SAME_GUILD,
	TOP_WEEK,
	LOW_HP,
	FULL_HP,
	UNRANKED,
	LOWER_RANK_THAN_THEM,
	BETTER_RANK_THAN_THEM,
	RICH,
	POOR,
	PET,
	PET_ON_EXPEDITION,
	PET_CLONE,
	GUILD_CHIEF,
	GUILD_ELDER,
	EFFECT,
	WEAPON,
	ARMOR,
	POTION,
	OBJECT,
	CLASS
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventInteractOtherPlayersPacket extends SmallEventPacket {
	keycloakId?: string;

	playerInteraction?: InteractOtherPlayerInteraction;

	data?: {
		rank?: number;
		level: number;
		classId: number;
		petId?: number;
		petName?: string;
		petSex?: SexTypeShort;
		guildName?: string;
		weaponId: number;
		armorId: number;
		potionId: number;
		objectId: number;
		effectId: string;
	};
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventInteractOtherPlayersRefuseToGivePoorPacket extends SmallEventPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventInteractOtherPlayersAcceptToGivePoorPacket extends SmallEventPacket {
}
