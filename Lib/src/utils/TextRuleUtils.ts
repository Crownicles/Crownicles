import {
	TEXT_ISSUES, TextIssueKind, TextRule
} from "../constants/TextRuleConstants";

export type TextIssue =
	| {
		kind: typeof TEXT_ISSUES.FORBIDDEN_CHARACTER; character: string;
	}
	| { kind: Exclude<TextIssueKind, typeof TEXT_ISSUES.FORBIDDEN_CHARACTER> };

/**
 * A typed text as it is kept: surrounding spaces dropped, the curly apostrophe of mobile keyboards straightened.
 * @param text
 */
export function normalizeText(text: string): string {
	return text.trim().replace(/\u2019/gu, "'");
}

/**
 * The first rule a normalized text breaks, or null when it is acceptable (guild names and descriptions, pet nicknames)
 * @param text - the normalized text to check
 * @param rule - the rule of the field the text is typed in
 */
export function findTextIssue(text: string, rule: TextRule): TextIssue | null {
	const allowed = new RegExp(`^[${rule.allowedCharacters}]$`, "u");
	const character = [...text].find(candidate => !allowed.test(candidate));
	if (character !== undefined) {
		return {
			kind: TEXT_ISSUES.FORBIDDEN_CHARACTER, character
		};
	}
	const pattern = rule.forbiddenPatterns.find(forbidden => new RegExp(forbidden.pattern, "u").test(text));
	if (pattern) {
		return { kind: pattern.issue };
	}
	if (text.length > rule.lengthRange.MAX) {
		return { kind: TEXT_ISSUES.TOO_LONG };
	}
	return text.length < rule.lengthRange.MIN ? { kind: TEXT_ISSUES.TOO_SHORT } : null;
}
