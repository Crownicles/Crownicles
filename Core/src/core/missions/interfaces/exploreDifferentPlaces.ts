import { IMission } from "../IMission";

export const missionInterface: IMission = {
	generateRandomVariant: () => 0,

	areParamsMatchingVariantAndBlob: (_variant, params, saveBlob) => {
		const placeId = params.placeId as number;
		if (!saveBlob) {
			return true;
		}
		return !saveBlob.toString().split(",")
			.includes(placeId.toString());
	},

	initialNumberDone: () => 0,

	updateSaveBlob: (_variant, saveBlob, params) => {
		const placeId = params.placeId as number;
		if (!saveBlob) {
			return Buffer.from(placeId.toString());
		}
		return Buffer.concat([saveBlob, Buffer.from(`,${placeId.toString()}`)]);
	}
};
