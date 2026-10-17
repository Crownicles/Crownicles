import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { FightRewardPacket } from "./FightRewardPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class KingGuardFightRewardPacket extends CrowniclesPacket {
	points!: number;

	money!: number;

	draw!: boolean;

	won!: boolean;

	petLoveChange?: FightRewardPacket["petLoveChange"];
}
