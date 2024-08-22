import {DraftBotPacket, sendablePacket, PacketDirection} from "../DraftBotPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildPacketReq extends DraftBotPacket {
	askedPlayer!: {
		rank?: number,
		keycloakId?: string
	};

	askedGuildName?: string;
}

export interface GuildMemberPacket {
	id: number;
	keycloakId: string;
	rank: number,
	score: number
	islandStatus: {
		isOnPveIsland: boolean,
		isOnBoat: boolean,
		isPveIslandAlly: boolean,
		isInactive: boolean
		cannotBeJoinedOnBoat: boolean
	}
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildPacketRes extends DraftBotPacket {
	foundGuild!: boolean;

	askedPlayerKeycloakId?: string;

	data?: {
		name: string,
		description?: string,
		chiefId: number,
		elderId: number,
		level: number,
		isMaxLevel: boolean,
		experience: {
			value: number,
			max: number
		},
		rank: {
			unranked: boolean,
			rank: number,
			numberOfGuilds: number,
			score: number
		},
		members: GuildMemberPacket[]
	};
}