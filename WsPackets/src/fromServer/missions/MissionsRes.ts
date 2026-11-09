import { FromServerPacket } from "../FromServerPacket";
import {
	DailyMissionStatus, Mission
} from "../../objects/Mission";
import { KingChallengeProgress } from "../../objects/KingChallenge";

export class MissionsRes extends FromServerPacket {
	public static readonly wireName = "MissionsRes";

	public missions!: Mission[];

	public campaignProgression!: number;

	public maxCampaignNumber!: number;

	public maxSideMissionSlots!: number;

	public dailyMission!: DailyMissionStatus;

	/** Absent from a server older than the king's challenge. */
	public kingChallenge?: KingChallengeProgress;
}
