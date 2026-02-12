import { IMission } from "../IMission";

const ORACLES = ["altar", "space"] as const;

export const missionInterface: IMission = {
	generateRandomVariant: () => 0,

	areParamsMatchingVariantAndBlob: (_variant, params, saveBlob) => {
		const oracleId = params.oracleId as string;
		if (!saveBlob) {
			return true;
		}
		const seenOracles = saveBlob.toString().split(",");
		return !seenOracles.includes(oracleId);
	},

	initialNumberDone: () => 0,

	updateSaveBlob: (_variant, saveBlob, params) => {
		const oracleId = params.oracleId as string;
		if (!ORACLES.includes(oracleId as typeof ORACLES[number])) {
			return saveBlob;
		}
		if (!saveBlob) {
			return Buffer.from(oracleId);
		}
		const seenOracles = saveBlob.toString().split(",");
		if (seenOracles.includes(oracleId)) {
			return saveBlob;
		}
		return Buffer.concat([saveBlob, Buffer.from(`,${oracleId}`)]);
	}
};
