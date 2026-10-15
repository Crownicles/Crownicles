export const TEXT_RULE_IDS = {
	GUILD_NAME: "guildName",
	GUILD_DESCRIPTION: "guildDescription",
	PET_NICKNAME: "petNickname"
} as const;
export type TextRuleId = typeof TEXT_RULE_IDS[keyof typeof TEXT_RULE_IDS];

export const TEXT_ISSUES = {
	FORBIDDEN_CHARACTER: "forbiddenCharacter",
	DOUBLE_PUNCTUATION: "doublePunctuation",
	DIGITS_ONLY: "digitsOnly",
	ACCENTED_ENDING: "accentedEnding",
	TOO_LONG: "tooLong",
	TOO_SHORT: "tooShort"
} as const;
export type TextIssueKind = typeof TEXT_ISSUES[keyof typeof TEXT_ISSUES];
export type TextPatternIssueKind = typeof TEXT_ISSUES.DOUBLE_PUNCTUATION | typeof TEXT_ISSUES.DIGITS_ONLY | typeof TEXT_ISSUES.ACCENTED_ENDING;

export type TextIssue =
	| {
		kind: typeof TEXT_ISSUES.FORBIDDEN_CHARACTER; character: string;
	}
	| { kind: Exclude<TextIssueKind, typeof TEXT_ISSUES.FORBIDDEN_CHARACTER> };

/** A rule Core applies to a typed text, sent as data so the app checks it without a copy of its own. */
export type TextRule = {
	min: number;
	max: number;

	/** Content of a regular expression character class, read with the `u` flag. */
	allowedCharacters: string;

	/** Regular expression sources, read with the `u` flag, that an acceptable text never matches. */
	forbiddenPatterns: {
		issue: TextPatternIssueKind; pattern: string;
	}[];
};

/** The text as Core keeps it: surrounding spaces dropped, the curly apostrophe of mobile keyboards straightened. */
export function normalizeText(text: string): string {
	return text.trim().replace(/\u2019/gu, "'");
}

/**
 * The first rule a normalized text breaks, or null when Core accepts it.
 * Mirrors Lib's `findTextIssue`; a RestWs test keeps both verdicts equal.
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
	if (text.length > rule.max) {
		return { kind: TEXT_ISSUES.TOO_LONG };
	}
	return text.length < rule.min ? { kind: TEXT_ISSUES.TOO_SHORT } : null;
}
