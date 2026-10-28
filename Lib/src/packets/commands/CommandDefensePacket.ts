import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import type { AiPersonality } from "../../constants/AiPersonalityConstants";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandDefensePacketReq extends CrowniclesPacket {}

/**
 * The class of the player only has one way to defend itself
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDefenseNoChoicePacketRes extends CrowniclesPacket {
	classId!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDefenseCancelPacketRes extends CrowniclesPacket {}

/**
 * The defense personality has been changed, a missing personality means a random one at each fight
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDefenseChangeSuccessPacketRes extends CrowniclesPacket {
	personality?: AiPersonality;
}
