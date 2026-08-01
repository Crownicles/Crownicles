import { IMission } from "../IMission";
import { TokensConstants } from "../../../../../Lib/src/constants/TokensConstants";

export const missionInterface: IMission = {
	areParamsMatchingVariantAndBlob: () => true,

	generateRandomVariant: () => 0,

	initialNumberDone: player => player.tokens >= TokensConstants.MAX ? 1 : 0,

	updateSaveBlob: () => null
};
