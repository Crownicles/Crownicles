import { CrowniclesPacket } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { NumberChangeReason } from "../../../../../Lib/src/constants/LogsConstants";

export type EditValueParameters = {
	amount: number;
	response: CrowniclesPacket[];
	reason: NumberChangeReason;
};

export type MissionHealthParameter = {
	shouldPokeMission: boolean;
	overHealCountsForMission: boolean;
};

/**
 * Import the PlayerActiveObjects type lazily to avoid circular dependencies
 */
type PlayerActiveObjectsType = import("./models/PlayerActiveObjects").PlayerActiveObjects;

export type HealthEditValueParameters = EditValueParameters & {
	missionHealthParameter?: MissionHealthParameter;

	/**
	 * When provided, enchantments will be considered for max health calculation.
	 * If not provided, base max health is used.
	 */
	playerActiveObjects?: PlayerActiveObjectsType;
};
