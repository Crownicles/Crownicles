import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import {
	BaseMission, CompletedMission
} from "../../types/CompletedMission";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class MissionsCompletedPacket extends CrowniclesPacket {
	keycloakId!: string;

	missions!: CompletedMission[];

	/**
	 * The next campaign mission to complete, if a campaign mission was just completed
	 * and the campaign is not finished. Lets the player see what comes next without /mission.
	 */
	nextCampaignMission?: BaseMission;
}
