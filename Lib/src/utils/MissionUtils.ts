import { BaseMission } from "../types/CompletedMission";

export type FromPlaceToPlaceBlobData = {
	startTimestamp: number; startMap: number;
};
export type FromPlaceToPlaceParams = {
	fromMap: number; toMap: number; time: number; orderMatter: boolean;
};

export abstract class MissionUtils {
	static fromPlaceToPlaceDataFromSaveBlob(saveBlob: Buffer): FromPlaceToPlaceBlobData | null {
		return saveBlob
			? {
				startTimestamp: Number(saveBlob.readBigUInt64LE()),
				startMap: saveBlob.readUInt16LE(8)
			}
			: null;
	}

	static fromPlaceToPlaceParamsFromVariant(variant: number): FromPlaceToPlaceParams {
		return {
			fromMap: variant >> 20 & 0x3ff,
			toMap: variant >> 10 & 0x3ff,
			time: variant & 0x3ff,
			orderMatter: (variant & 0x40000000) !== 0
		};
	}

	static isRequiredFightActionId(mission: BaseMission): boolean {
		return ["fightAttacks", "finishWithAttack"].includes(mission.missionId);
	}

	static isRequiredMapLocationMapType(mission: BaseMission): boolean {
		return ["goToPlace"].includes(mission.missionId);
	}
}
