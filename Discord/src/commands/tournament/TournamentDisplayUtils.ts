import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import {
	TournamentCategories, TournamentCategory, TournamentLevelSettings
} from "../../../../Lib/src/types/Tournament";
import { getTournamentEligibleCategories } from "../../../../Lib/src/utils/TournamentUtils";
import { Language } from "../../../../Lib/src/Language";
import { TournamentErrorCode } from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import i18n from "../../translations/i18n";

export function getTournamentErrorDescription(errorCode: TournamentErrorCode, lng: Language): string {
	return i18n.t(`commands:tournament.errors.${errorCode}`, {
		lng,
		minLevel: TournamentConstants.MINIMUM_PLAYER_LEVEL,
		minMembers: TournamentConstants.MINIMUM_SERVER_MEMBER_COUNT,
		minDays: TournamentConstants.REGISTRATION_MINIMUM_DAYS,
		maxDays: TournamentConstants.REGISTRATION_MAXIMUM_DAYS,
		maxGames: TournamentConstants.BO3_MAX_GAMES
	});
}

export function getTournamentCategoryLabel(category: TournamentCategory, lng: Language): string {
	return i18n.t(`commands:tournament.categories.${category}`, {
		lng,
		minLevel: category === TournamentCategories.LEVEL_50
			? TournamentConstants.MINIMUM_PLAYER_LEVEL
			: TournamentConstants.HIGH_CATEGORY_MIN_LEVEL,
		maxLevel: TournamentConstants.HIGH_CATEGORY_MIN_LEVEL - 1
	});
}

export function getTournamentLevelRuleDescription(levelSettings: TournamentLevelSettings, lng: Language): string {
	return i18n.t(`commands:tournament.levelModes.${levelSettings.levelLimitMode}`, {
		lng,
		levelCap: levelSettings.levelCap ?? 0,
		lowCategoryCap: TournamentConstants.LOW_CATEGORY_LEVEL_CAP,
		highCategoryCap: TournamentConstants.HIGH_CATEGORY_LEVEL_CAP
	});
}

/**
 * Summary of the participant thresholds required for the fights to start
 * @param levelSettings
 * @param lng
 */
export function getTournamentThresholdsSummary(levelSettings: TournamentLevelSettings, lng: Language): string {
	const eligibleCategories = getTournamentEligibleCategories(levelSettings);
	return i18n.t(eligibleCategories.length > 1
		? "commands:tournament.thresholds.summaryPerCategory"
		: "commands:tournament.thresholds.summarySingleCategory", {
		lng,
		total: TournamentConstants.MINIMUM_TOTAL_PARTICIPANTS,
		perCategory: TournamentConstants.MINIMUM_PARTICIPANTS_PER_CATEGORY,
		category: getTournamentCategoryLabel(eligibleCategories[0], lng)
	});
}

export type TournamentParticipantCounts = {
	total: number;
	byCategory: Record<TournamentCategory, number>;
};

/**
 * Progress of the registrations towards the thresholds required for the fights to start
 * @param levelSettings
 * @param counts
 * @param lng
 */
export function getTournamentThresholdsProgress(
	levelSettings: TournamentLevelSettings,
	counts: TournamentParticipantCounts,
	lng: Language
): string {
	const lines = [
		i18n.t("commands:tournament.thresholds.totalLine", {
			lng,
			count: counts.total,
			required: TournamentConstants.MINIMUM_TOTAL_PARTICIPANTS
		}),
		...getTournamentEligibleCategories(levelSettings).map(category => i18n.t("commands:tournament.thresholds.categoryLine", {
			lng,
			category: getTournamentCategoryLabel(category, lng),
			count: counts.byCategory[category],
			required: TournamentConstants.MINIMUM_PARTICIPANTS_PER_CATEGORY
		}))
	];
	return lines.join("\n");
}
