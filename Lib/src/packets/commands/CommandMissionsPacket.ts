import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { BaseMission } from "../../types/CompletedMission";
import { KingChallengeProgress } from "../../types/KingChallenge";
import { QuestProgress } from "../../types/QuestProgress";

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

	kingChallenge!: KingChallengeProgress;

	quests!: QuestProgress[];
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionPlayerNotFoundPacket extends CrowniclesPacket {}
