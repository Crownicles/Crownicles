import { IMission } from "../IMission";

export const missionInterface: IMission = {
	generateRandomVariant: () => 0,

	areParamsMatchingVariantAndBlob: (_variant, params, saveBlob) => {
		if (!saveBlob) {
			return true;
		}
		return !saveBlob.toString().includes(`${params.classId}`);
	},

	initialNumberDone: () => 0,

	updateSaveBlob: (_variant, saveBlob, params) => {
		if (!saveBlob) {
			return Buffer.from(`${params.classId}`);
		}
		return Buffer.concat([saveBlob, Buffer.from(`,${params.classId}`)]);
	}
};
