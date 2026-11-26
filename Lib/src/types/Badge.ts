export enum Badge {
	BEST_V1_PLAYER = "top_v1_player",
	TOP_10_V1 = "top_10_v1",
	BOT_OWNER = "bot_owner",
	TECHNICAL_TEAM = "technical_team",
	TOP_GLORY = "top_glory",
	SUPPORT = "support",
	CONTEST = "contest",
	DONOR = "donor",
	MAJOR_BUG_REPORTER = "major_bug_reporter",
	RANDOM = "random",
	FIRST_20_MEMBERS = "first_20_members",
	TOP_1_BEFORE_RESET = "top_1_before_reset",
	RICH = "rich",
	ADVERTISER = "advertiser",
	REDACTOR = "redactor",
	TRANSLATOR = "translator",
	TOP_WEEK = "top_week",
	CHRISTMAS = "christmas",
	FUNNY = "funny",
	POWERFUL_GUILD = "powerful_guild",
	VERY_POWERFUL_GUILD = "very_powerful_guild",
	TOURNAMENT_WINNER = "tournament_winner",
	EARLY_CLASS_ADOPTER = "early_class_adopter",
	LEGENDARY_PET = "legendary_pet",
	MISSION_COMPLETER = "mission_completer",
	GOOD_BUG_REPORTER = "good_bug_reporter",
	VOTER = "voter",
	ANIMAL_LOVER = "animal_lover",
	EXPERT_EXPEDITEUR = "expert_expediteur",
	ORACLE_PATRON = "oracle_patron",
	SENTIMENTAL_CRAFTER = "sentimental_crafter",
	MASTER_CHEF = "master_chef"
}

/**
 * Badges a big event outcome may depend on: those earned inside the game world, that a character could plausibly know about.
 * Badges about the staff, donations, contests, bug reports or votes stay out of the fiction.
 * The bought rich badge is left out too: the money requirement tells how wealthy the player really is.
 */
export const EVENT_OUTCOME_BADGES = [
	Badge.ANIMAL_LOVER,
	Badge.EXPERT_EXPEDITEUR,
	Badge.LEGENDARY_PET,
	Badge.MASTER_CHEF,
	Badge.SENTIMENTAL_CRAFTER,
	Badge.ORACLE_PATRON,
	Badge.MISSION_COMPLETER,
	Badge.TOP_GLORY,
	Badge.POWERFUL_GUILD,
	Badge.VERY_POWERFUL_GUILD
] as const;

export type EventOutcomeBadge = typeof EVENT_OUTCOME_BADGES[number];
