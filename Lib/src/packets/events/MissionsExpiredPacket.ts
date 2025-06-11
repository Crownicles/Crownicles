import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { BaseMission } from "../../types/CompletedMission";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class MissionsExpiredPacket extends CrowniclesPacket {
	keycloakId!: string;

	missions!: BaseMission[];
}
