import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildMissionPacketReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildMissionPacketRes extends CrowniclesPacket {
	missionId!: string;

	objective!: number;

	numberDone!: number;

	playerContribution!: number;

	expiresAt!: number;

	completed!: boolean;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildMissionNoMission extends CrowniclesPacket {}
