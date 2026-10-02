import type {GameRules} from "ws-packets/src/objects/GameRules";
import type {TextRule} from "ws-packets/src/objects/TextRules";
import {ONBOARDING_MISSION_IDS, ONBOARDING_TRIAL_IDS} from "ws-packets/src/objects/Onboarding";
import {TEXT_ISSUES} from "ws-packets/src/objects/TextRules";

const ACCENTS = "ÇçÜüÉéÂâÄäÀàÊêËëÈèÏïÎîÔôÖöÛû";
const PUNCTUATION = "!,'.:()\\-";

function nameRule(min: number, max: number): TextRule {
	return {
		min,
		max,
		allowedCharacters: `A-Za-z0-9 ${ACCENTS}${PUNCTUATION}`,
		forbiddenPatterns: [
			{issue: TEXT_ISSUES.DOUBLE_PUNCTUATION, pattern: `[${PUNCTUATION}]{2}`},
			{issue: TEXT_ISSUES.DIGITS_ONLY, pattern: "^[0-9 ]+$"},
			{issue: TEXT_ISSUES.ACCENTED_ENDING, pattern: `[${ACCENTS}]{2}$`}
		]
	};
}

/** Rules as a server would send them; screens under test read these instead of the downloaded bundle. */
export const fakeGameRules: GameRules = {
	textRules: {guildName: nameRule(2, 15), guildDescription: nameRule(2, 140), petNickname: nameRule(3, 16)},
	guild: {creationPrice: 5000, maxMembers: 6, recruitmentMinScoreSteps: [0, 500, 1_000, 2_500, 5_000]},
	journeyLevels: {classes: 4, fights: 8, guild: 10},
	fight: {minimalEnergyRatio: 0.8},
	pet: {sellPrice: {min: 100, max: 50_000}},
	onboardingTrials: [
		{id: ONBOARDING_TRIAL_IDS.AUDIENCE, missions: [ONBOARDING_MISSION_IDS.COMMAND_MISSION, ONBOARDING_MISSION_IDS.SPEND_TOKENS, ONBOARDING_MISSION_IDS.EARN_MONEY]},
		{id: ONBOARDING_TRIAL_IDS.ROAD, missions: [ONBOARDING_MISSION_IDS.FIND_OR_BUY_ITEM, ONBOARDING_MISSION_IDS.DRINK_POTION, ONBOARDING_MISSION_IDS.COMMAND_MAP, ONBOARDING_MISSION_IDS.VISIT_CITY_NPC]},
		{id: ONBOARDING_TRIAL_IDS.PATH, missions: [ONBOARDING_MISSION_IDS.CHOOSE_CLASS]}
	]
};
