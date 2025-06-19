import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { CompletedMission } from "../../types/CompletedMission";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class MissionsCompletedPacket extends CrowniclesPacket {
	keycloakId!: string;

	missions!: CompletedMission[];
}
