import { describe, it, expect } from 'vitest';
import { findTextIssue, normalizeText, progressBar } from "../../src/utils/StringUtils";
import { TEXT_ISSUES, TextRuleConstants } from "../../src/constants/TextRuleConstants";

describe('progressBar', () => {
	it('should create a 50% progress bar correctly', () => {
		const result = progressBar(50, 100);
		expect(result).toBe("```[▇▇▇▇▇▇▇▇▇▇——————————]50%```");
	});

	it('should create a 100% progress bar correctly', () => {
		const result = progressBar(100, 100);
		expect(result).toBe("```[▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇]100%```");
	});

	it('should create a 0% progress bar correctly', () => {
		const result = progressBar(0, 100);
		expect(result).toBe("```[————————————————————]0%```");
	});

	it('should handle negative values by setting progress to 0%', () => {
		const result = progressBar(-50, 100);
		expect(result).toBe("```[————————————————————]0%```");
	});

	it('should handle NaN values by setting progress to 0%', () => {
		const result = progressBar(NaN, 100);
		expect(result).toBe("```[————————————————————]0%```");
	});

	it('should handle Infinity values by setting progress to 0%', () => {
		const result = progressBar(Infinity, 100);
		expect(result).toBe("```[————————————————————]0%```");
	});

	it('should cap progress at 100% when value exceeds maxValue', () => {
		const result = progressBar(150, 100);
		expect(result).toBe("```[▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇]100%```");
	});

	it('should handle decimal values correctly', () => {
		const result = progressBar(33.33, 100);
		expect(result).toBe("```[▇▇▇▇▇▇▇—————————————]33%```");
	});
});
describe("findTextIssue", () => {
	it.each([
		["Les Rois", null],
		["Les  Rois", null],
		["L'Ordre", null],
		["1!", null],
		["Rééduqués", null],
		["L''Ordre", { kind: TEXT_ISSUES.DOUBLE_PUNCTUATION }],
		["Rois!!", { kind: TEXT_ISSUES.DOUBLE_PUNCTUATION }],
		["12 34", { kind: TEXT_ISSUES.DIGITS_ONLY }],
		["Caféé", { kind: TEXT_ISSUES.ACCENTED_ENDING }],
		["Rois_", { kind: TEXT_ISSUES.FORBIDDEN_CHARACTER, character: "_" }],
		["Rois👑", { kind: TEXT_ISSUES.FORBIDDEN_CHARACTER, character: "👑" }],
		["a", { kind: TEXT_ISSUES.TOO_SHORT }],
		["abcdefghijklmnop", { kind: TEXT_ISSUES.TOO_LONG }]
	])("judges the guild name %j", (name, issue) => {
		expect(findTextIssue(name, TextRuleConstants.GUILD_NAME)).toEqual(issue);
	});

	it("uses the length of the field it checks", () => {
		expect(findTextIssue("Rex", TextRuleConstants.GUILD_NAME)).toBeNull();
		expect(findTextIssue("Re", TextRuleConstants.PET_NICKNAME)).toEqual({ kind: TEXT_ISSUES.TOO_SHORT });
	});
});

describe("normalizeText", () => {
	it("keeps what a mobile keyboard types acceptable", () => {
		expect(normalizeText(" L’Ordre ")).toBe("L'Ordre");
	});
});
