import { IMission } from "../IMission";
import { ItemConstants } from "../../../../../Lib/src/constants/ItemConstants";
import {
	OwnedMainItem, ownsMainItemMatching
} from "../OwnedMainItems";

const REQUIRED_LEVEL = 5;

/**
 * Whether a weapon or shield qualifies for the mission: epic rarity (or better)
 * and upgraded to at least the required level.
 */
function isEpicItemAtRequiredLevel({
	rarity, level
}: OwnedMainItem): boolean {
	return rarity >= ItemConstants.RARITY.EPIC && level >= REQUIRED_LEVEL;
}

export const missionInterface: IMission = {
	generateRandomVariant: () => 0,

	areParamsMatchingVariantAndBlob: (_variant, params) => isEpicItemAtRequiredLevel({
		rarity: params.rarity as number,
		level: params.newLevel as number
	}),

	/**
	 * Validate the mission as soon as it is assigned if the player already owns a
	 * qualifying weapon or shield, so they don't have to upgrade an item again.
	 */
	initialNumberDone: async player => await ownsMainItemMatching(player, isEpicItemAtRequiredLevel) ? 1 : 0,

	updateSaveBlob: () => null
};
