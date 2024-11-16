import {IMission} from "../IMission";

export const missionInterface: IMission = {
	generateRandomVariant: () => 0,

	areParamsMatchingVariantAndBlob: (variant, params, saveBlob) => {
		if (!saveBlob) {
			return true;
		}
		return !saveBlob.toString().split(",")
			.includes(params.placeId.toString());
	},

	initialNumberDone: () => 0,

	updateSaveBlob: (variant, saveBlob, params) => {
		if (!saveBlob) {
			return Buffer.from(params.placeId.toString());
		}
		return Buffer.concat([saveBlob, Buffer.from(`,${params.placeId.toString()}`)]);
	}
};