import {
	describe, expect, it
} from "vitest";
import {
	TEXT_ISSUES as CORE_TEXT_ISSUES, TextRule, TextRuleConstants
} from "../../../Lib/src/constants/TextRuleConstants";
import {
	findTextIssue as coreFindTextIssue, normalizeText as coreNormalizeText
} from "../../../Lib/src/utils/StringUtils";
import {
	findTextIssue, normalizeText, TEXT_ISSUES, TextRuleId
} from "../../../WsPackets/src/objects/TextRules";
import { buildGameRules } from "../../src/services/GameRules";

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
