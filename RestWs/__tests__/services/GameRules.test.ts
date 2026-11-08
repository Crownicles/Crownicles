import {
	describe, expect, it
} from "vitest";
import {
	TEXT_ISSUES as CORE_TEXT_ISSUES, TextRule, TextRuleConstants
} from "../../../Lib/src/constants/TextRuleConstants";
import {
	findTextIssue as coreFindTextIssue, normalizeText as coreNormalizeText
} from "../../../Lib/src/utils/TextRuleUtils";
import {
	findTextIssue, normalizeText, TEXT_ISSUES, TextRuleId
} from "../../../WsPackets/src/objects/TextRules";
import { buildGameRules } from "../../src/services/GameRules";
import { FightConstants } from "../../../Lib/src/constants/FightConstants";
import { KingChallengeConstants } from "../../../Lib/src/constants/KingChallengeConstants";
import { TokensConstants } from "../../../Lib/src/constants/TokensConstants";

const CORE_RULES: Record<TextRuleId, TextRule> = {
	guildName: TextRuleConstants.GUILD_NAME,
	guildDescription: TextRuleConstants.GUILD_DESCRIPTION,
	petNickname: TextRuleConstants.PET_NICKNAME
};

const TEXTS = [
	"", "a", "Ab", "Rex", "Les Rois", "Les  Rois", " Les Rois  ", "L'Ordre", "L’Ordre", "L''Ordre", "Rois!", "Rois!!",
	"(Rois)", "A.-B", "12", "12 34", "1!", "R2D2", "Café", "Caféé", "Rééduqués", "Été", "éé", "Naïve", "Les Œufs",
	"Rois_", "Rois👑", "Chevaliers Noirs", "abcdefghijklmnop", "Rois:Fous", "Ro,is", "Roisù",
	"Une guilde de marchands, fiers et loyaux. Nous voyageons de ville en ville."
];

describe("text rules sent to the app", () => {
	const rules = buildGameRules().textRules;

	it.each(Object.keys(CORE_RULES) as TextRuleId[])("give Core's verdict for %s", ruleId => {
		for (const text of TEXTS) {
			expect(findTextIssue(normalizeText(text), rules[ruleId]), JSON.stringify(text))
				.toEqual(coreFindTextIssue(coreNormalizeText(text), CORE_RULES[ruleId]));
		}
	});

	it("name the issues as Core does", () => {
		expect(TEXT_ISSUES).toEqual(CORE_TEXT_ISSUES);
	});
});

describe("friendly fights described to the app", () => {
	it("cap the fighters at the level Core fights them at", () => {
		expect(buildGameRules().friendlyFight.levelCap).toBe(FightConstants.FRIENDLY_FIGHT_LEVEL_CAP);
	});
});

describe("city cooldowns sent to the app", () => {
	it("are whole hours, as the city notes word them", () => {
		for (const hours of Object.values(buildGameRules().cooldownHours)) {
			expect(Number.isInteger(hours) && hours > 0, String(hours)).toBe(true);
		}
	});
});

describe("king's challenge rules sent to the app", () => {
	it("give a reward for every tier of the week, champion tier included, and Core's token cap", () => {
		const rules = buildGameRules().kingChallenge;
		const thresholds = KingChallengeConstants.computeThresholds(KingChallengeConstants.DEFAULT_REFERENCE_SCORES);
		expect(rules.tierRewards).toHaveLength(thresholds.length);
		expect(rules.tierRewards.at(-1)).toEqual(KingChallengeConstants.REWARDS.at(-1));
		expect(rules.tokenCap).toBe(TokensConstants.MAX);
	});
});
