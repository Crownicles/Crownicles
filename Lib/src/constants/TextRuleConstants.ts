import { ConstantRange } from "./Constants";
import { GuildConstants } from "./GuildConstants";
import { PetConstants } from "./PetConstants";

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

/** Written as data, not code, so the server can hand the same rule to the mobile app. */
export type TextRule = {
	lengthRange: ConstantRange;

	/** Content of a regular expression character class, read with the `u` flag. */
	allowedCharacters: string;

	/** Regular expression sources, read with the `u` flag, that an acceptable text never matches. */
	forbiddenPatterns: readonly {
		issue: TextPatternIssueKind; pattern: string;
	}[];
};

const ACCENTS = "ÇçÜüÉéÂâÄäÀàÊêËëÈèÏïÎîÔôÖöÛû";
const PUNCTUATION = "!,'.:()\\-";

const NAME_CHARACTERS = {
	allowedCharacters: `A-Za-z0-9 ${ACCENTS}${PUNCTUATION}`,
	forbiddenPatterns: [
		{
			issue: TEXT_ISSUES.DOUBLE_PUNCTUATION, pattern: `[${PUNCTUATION}]{2}`
		},
		{
			issue: TEXT_ISSUES.DIGITS_ONLY, pattern: "^[0-9 ]+$"
		},
		{
			issue: TEXT_ISSUES.ACCENTED_ENDING, pattern: `[${ACCENTS}]{2}$`
		}
	]
} as const;

export abstract class TextRuleConstants {
	static readonly GUILD_NAME: TextRule = {
		lengthRange: GuildConstants.GUILD_NAME_LENGTH_RANGE,
		...NAME_CHARACTERS
	};

	static readonly GUILD_DESCRIPTION: TextRule = {
		lengthRange: GuildConstants.DESCRIPTION_LENGTH_RANGE,
		...NAME_CHARACTERS
	};

	static readonly PET_NICKNAME: TextRule = {
		lengthRange: PetConstants.NICKNAME_LENGTH_RANGE,
		...NAME_CHARACTERS
	};
}
