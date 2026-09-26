import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { LeagueInfo } from "../../types/LeagueInfo";
import { LeagueRewardAvailability } from "../../types/LeagueRewardAvailability";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandLeagueInfoReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.NONE)
export class CommandLeagueInfoRes extends CrowniclesPacket {
	leagues!: LeagueInfo[];

	currentLeagueId!: number;

	glory!: number;

	rewardAvailability!: LeagueRewardAvailability;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandLeagueRewardPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandLeagueRewardNotSundayPacketRes extends CrowniclesPacket {
	nextSunday!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandLeagueRewardNoPointsPacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandLeagueRewardAlreadyClaimedPacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandLeagueRewardSuccessPacketRes extends CrowniclesPacket {
	score!: number;

	money!: number;

	xp!: number;

	gloryPoints!: number;

	oldLeagueId!: number;

	rank!: number;
}
