import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventLeagueRewardPacket extends SmallEventPacket {
	rewardToday!: boolean;

	leagueId!: number;

	money!: number;

	xp!: number;

	nextRewardDate!: number;

	enoughFights!: boolean;
}
