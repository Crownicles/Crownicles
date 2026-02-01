import {
	CrowniclesPacket, sendablePacket, PacketDirection
} from "../CrowniclesPacket";
import { GuildMember } from "../../types/GuildMember";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildPacketReq extends CrowniclesPacket {
	askedPlayer!: {
		rank?: number;
		keycloakId?: string;
	};

	askedGuildName?: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildPacketRes extends CrowniclesPacket {
	foundGuild!: boolean;

	askedPlayerKeycloakId?: string;

	data?: {
		name: string;
		description?: string;
		chiefId: number;
		elderId: number | null;
		level: number;
		isMaxLevel: boolean;
		experience: {
			value: number;
			max: number;
		};
		rank: {
			unranked: boolean;
			rank: number;
			numberOfGuilds: number;
			score: number;
		};
		members: GuildMember[];
	};
}
