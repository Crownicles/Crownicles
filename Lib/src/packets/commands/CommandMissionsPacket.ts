import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { BaseMission } from "../../types/CompletedMission";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandMissionsPacketReq extends CrowniclesPacket {
	askedPlayer!: {
		rank?: number;
		keycloakId?: string;
	};
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionsPacketRes extends CrowniclesPacket {
	keycloakId!: string;

	missions!: BaseMission[];

	campaignProgression!: number;

	maxCampaignNumber!: number;

	maxSideMissionSlots!: number;

	guildMission!: {
		missionId: string;
		objective: number;
		numberDone: number;
		playerContribution: number;
		expiresAt: number;
		completed: boolean;
	} | null;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionPlayerNotFoundPacket extends CrowniclesPacket {}
