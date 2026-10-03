import { FromServerPacket } from "../FromServerPacket";
import {
	DailyMissionStatus, Mission
} from "../../objects/Mission";

export class MissionsRes extends FromServerPacket {
	public static readonly wireName = "MissionsRes";

	public missions!: Mission[];

	public campaignProgression!: number;

	public maxCampaignNumber!: number;

	public maxSideMissionSlots!: number;

	public dailyMission!: DailyMissionStatus;
}
