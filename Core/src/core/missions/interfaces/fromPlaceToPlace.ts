import { IMission } from "../IMission";
import { hoursToMilliseconds } from "../../../../../Lib/src/utils/TimeUtils";
import {
	FromPlaceToPlaceParams, MissionUtils
} from "../../../../../Lib/src/utils/MissionUtils";

const saveBlobFromData = function(startTimestamp: number, startMap: number): Buffer {
	const saveBlob = Buffer.alloc(10);
	saveBlob.writeBigUInt64LE(BigInt(startTimestamp));
	saveBlob.writeUInt16LE(startMap, 8);
	return saveBlob;
};

/**
 * Check if the link matches the variant params
 * @param variantParams
 * @param startMap
 * @param endMap
 */
function checkLink(variantParams: FromPlaceToPlaceParams, startMap: number, endMap: number): boolean {
	return variantParams.fromMap === startMap && variantParams.toMap === endMap;
}

export const missionInterface: IMission = {
	areParamsMatchingVariantAndBlob: (variant, params, saveBlob) => {
		if (!saveBlob) {
			return false;
		}
		const variantParams = MissionUtils.fromPlaceToPlaceParamsFromVariant(variant);
		const saveData = MissionUtils.fromPlaceToPlaceDataFromSaveBlob(saveBlob);
		if (!saveData) {
			return false;
		}
		const otherMap = params.mapId as number;

		return saveData.startTimestamp + hoursToMilliseconds(variantParams.time) > Date.now()
			&& (checkLink(variantParams, saveData.startMap, otherMap)
				|| !variantParams.orderMatter && checkLink(variantParams, otherMap, saveData.startMap));
	},

	generateRandomVariant: () => 0,

	initialNumberDone: () => 0,

	alwaysUpdateBlob: true,

	updateSaveBlob: (variant, saveBlob, params) => {
		const variantParams = MissionUtils.fromPlaceToPlaceParamsFromVariant(variant);
		if (!saveBlob) {
			if (params.mapId === variantParams.fromMap || !variantParams.orderMatter && params.mapId === variantParams.toMap) {
				return saveBlobFromData(Date.now(), params.mapId);
			}
			return null;
		}
		const saveData = MissionUtils.fromPlaceToPlaceDataFromSaveBlob(saveBlob);
		if (!saveData) {
			return null;
		}
		if (saveData.startMap === params.mapId) {
			return saveBlobFromData(Date.now(), params.mapId);
		}
		if (saveData.startTimestamp + hoursToMilliseconds(variantParams.time) < Date.now()) {
			if (saveData.startMap === params.mapId) {
				return saveBlobFromData(Date.now(), params.mapId);
			}
			return null;
		}
		return saveBlob;
	}
};
