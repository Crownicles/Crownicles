import { ExpeditionConstants } from "../constants/ExpeditionConstants";

/**
 * Get the risk category name based on risk rate
 * @param riskRate - Risk rate percentage (0-100)
 * @returns The category name key for translations
 */
export function getRiskCategoryName(riskRate: number): string {
	if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.TRIVIAL.MAX) {
		return ExpeditionConstants.RISK_DISPLAY_CATEGORIES.TRIVIAL.NAME;
	}
	if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.VERY_LOW.MAX) {
		return ExpeditionConstants.RISK_DISPLAY_CATEGORIES.VERY_LOW.NAME;
	}
	if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.LOW.MAX) {
		return ExpeditionConstants.RISK_DISPLAY_CATEGORIES.LOW.NAME;
	}
	if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.MODERATE.MAX) {
		return ExpeditionConstants.RISK_DISPLAY_CATEGORIES.MODERATE.NAME;
	}
	if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.HIGH.MAX) {
		return ExpeditionConstants.RISK_DISPLAY_CATEGORIES.HIGH.NAME;
	}
	if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.VERY_HIGH.MAX) {
		return ExpeditionConstants.RISK_DISPLAY_CATEGORIES.VERY_HIGH.NAME;
	}
	if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.EXTREME.MAX) {
		return ExpeditionConstants.RISK_DISPLAY_CATEGORIES.EXTREME.NAME;
	}
	return ExpeditionConstants.RISK_DISPLAY_CATEGORIES.DESPERATE.NAME;
}

/**
 * Get the difficulty category name based on difficulty value
 * @param difficulty - Difficulty value (0-100)
 * @returns The category name key for translations
 */
export function getDifficultyCategoryName(difficulty: number): string {
	if (difficulty <= ExpeditionConstants.DIFFICULTY_DISPLAY_CATEGORIES.TRIVIAL.MAX) {
		return ExpeditionConstants.DIFFICULTY_DISPLAY_CATEGORIES.TRIVIAL.NAME;
	}
	if (difficulty <= ExpeditionConstants.DIFFICULTY_DISPLAY_CATEGORIES.EASY.MAX) {
		return ExpeditionConstants.DIFFICULTY_DISPLAY_CATEGORIES.EASY.NAME;
	}
	if (difficulty <= ExpeditionConstants.DIFFICULTY_DISPLAY_CATEGORIES.MODERATE.MAX) {
		return ExpeditionConstants.DIFFICULTY_DISPLAY_CATEGORIES.MODERATE.NAME;
	}
	if (difficulty <= ExpeditionConstants.DIFFICULTY_DISPLAY_CATEGORIES.CHALLENGING.MAX) {
		return ExpeditionConstants.DIFFICULTY_DISPLAY_CATEGORIES.CHALLENGING.NAME;
	}
	return ExpeditionConstants.DIFFICULTY_DISPLAY_CATEGORIES.TREACHEROUS.NAME;
}

/**
 * Get the reward category name based on reward index value
 * @param rewardIndex - Reward index value (0-9)
 * @returns The category name key for translations
 */
export function getRewardCategoryName(rewardIndex: number): string {
	if (rewardIndex <= ExpeditionConstants.REWARD_DISPLAY_CATEGORIES.MEAGER.MAX) {
		return ExpeditionConstants.REWARD_DISPLAY_CATEGORIES.MEAGER.NAME;
	}
	if (rewardIndex <= ExpeditionConstants.REWARD_DISPLAY_CATEGORIES.MODEST.MAX) {
		return ExpeditionConstants.REWARD_DISPLAY_CATEGORIES.MODEST.NAME;
	}
	if (rewardIndex <= ExpeditionConstants.REWARD_DISPLAY_CATEGORIES.SUBSTANTIAL.MAX) {
		return ExpeditionConstants.REWARD_DISPLAY_CATEGORIES.SUBSTANTIAL.NAME;
	}
	if (rewardIndex <= ExpeditionConstants.REWARD_DISPLAY_CATEGORIES.BOUNTIFUL.MAX) {
		return ExpeditionConstants.REWARD_DISPLAY_CATEGORIES.BOUNTIFUL.NAME;
	}
	return ExpeditionConstants.REWARD_DISPLAY_CATEGORIES.LEGENDARY.NAME;
}

/**
 * Get duration range as array for indexed access
 * @returns Array of duration ranges [SHORT, MEDIUM, LONG]
 */
export function getDurationRangesArray(): Array<{
	min: number;
	max: number;
}> {
	return [
		{
			min: ExpeditionConstants.DURATION_RANGES.SHORT.MIN,
			max: ExpeditionConstants.DURATION_RANGES.SHORT.MAX
		},
		{
			min: ExpeditionConstants.DURATION_RANGES.MEDIUM.MIN,
			max: ExpeditionConstants.DURATION_RANGES.MEDIUM.MAX
		},
		{
			min: ExpeditionConstants.DURATION_RANGES.LONG.MIN,
			max: ExpeditionConstants.DURATION_RANGES.LONG.MAX
		}
	];
}
