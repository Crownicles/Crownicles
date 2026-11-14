import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { QuestProgress } from "../../types/QuestProgress";

/**
 * Sent when a player completes a step of a quest for the first time: the quest is obtained with its first step, and completed with its last one
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class QuestUpdatedPacket extends CrowniclesPacket {
	keycloakId!: string;

	quest!: QuestProgress;
}
