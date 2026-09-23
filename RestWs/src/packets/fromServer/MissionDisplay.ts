import { BaseMission } from "../../../../Lib/src/types/CompletedMission";
import { MissionUtils } from "../../../../Lib/src/utils/MissionUtils";
import { getRiskCategoryName } from "../../../../Lib/src/utils/ExpeditionUtils";
import {
	Mission, MISSION_VARIANTS
} from "../../../../WsPackets/src/objects/Mission";

export function missionData(mission: BaseMission): Mission {
	const {
		saveBlob, ...data
	} = mission;
	if (mission.missionId === MISSION_VARIANTS.EXPEDITION_RISK) {
		return {
			...data, riskCategory: getRiskCategoryName(mission.missionVariant)
		};
	}
	if (mission.missionId !== MISSION_VARIANTS.TRAVEL) {
		return data;
	}
	const progress = saveBlob ? MissionUtils.fromPlaceToPlaceDataFromSaveBlob(Buffer.from(saveBlob, "binary")) : null;
	return {
		...data,
		travel: {
			...MissionUtils.fromPlaceToPlaceParamsFromVariant(mission.missionVariant),
			...progress ? { progress } : {}
		}
	};
}
