import { IMission } from "../IMission";
import { ItemConstants } from "../../../../../Lib/src/constants/ItemConstants";
import { ownsMainItemMatching } from "../OwnedMainItems";

export const missionInterface: IMission = {
	generateRandomVariant: () => 0,

	areParamsMatchingVariantAndBlob: () => true,

	/**
	 * Validate the mission as soon as it is assigned if the player already owns an
	 * upgraded weapon or shield, so they don't have to pay for a harder upgrade (#5067).
	 */
	initialNumberDone: async player => await ownsMainItemMatching(player, ({ level }) => level >= ItemConstants.MIN_UPGRADE_LEVEL) ? 1 : 0,

	updateSaveBlob: () => null
};
