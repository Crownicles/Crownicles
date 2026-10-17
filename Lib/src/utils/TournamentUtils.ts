import { TournamentConstants } from "../constants/TournamentConstants";
import {
	TournamentCategories, TournamentCategory, TournamentLevelLimitModes, TournamentLevelSettings
} from "../types/Tournament";

/**
 * Categories that can receive participants: refusing every level of the high category leaves it empty by design
 * @param levelSettings
 */
export function getTournamentEligibleCategories(levelSettings: TournamentLevelSettings): TournamentCategory[] {
	const highCategoryClosed = levelSettings.levelLimitMode === TournamentLevelLimitModes.REJECT
		&& levelSettings.levelCap !== null
		&& levelSettings.levelCap < TournamentConstants.HIGH_CATEGORY_MIN_LEVEL;
	return highCategoryClosed
		? [TournamentCategories.LEVEL_50]
		: Object.values(TournamentCategories);
}
