import { CrowniclesPacket } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { NumberChangeReason } from "../../../../../Lib/src/constants/LogsConstants";

export type EditValueParameters = {
	amount: number;
	response: CrowniclesPacket[];
	reason: NumberChangeReason;
	ignoreBlessing?: boolean;
};

export type MissionHealthParameter = {
	shouldPokeMission: boolean;
	overHealCountsForMission: boolean;
};

export type HealthEditValueParameters = EditValueParameters & {
	missionHealthParameter?: MissionHealthParameter;
};
