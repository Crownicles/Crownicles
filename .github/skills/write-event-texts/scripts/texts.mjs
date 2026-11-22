/**
 * Style checks of the texts of a rewritten event
 */
import {
	entriesOf, keysOf
} from "./common.mjs";
import {
	byCodePoint, difference, get, need, pyRepr, truthy
} from "./python.mjs";

const TEXT_LENGTHS = {
	intro: [180, 420],
	choice: [8, 90],
	// Bounds of what is reasonable, not a target: an outcome is as long as what it tells (SKILL.md)
	outcome: [60, 420]
};

// Python's Unicode \w and \s, so that the checks behave like the original Python validator
const WORD = "[\\p{L}\\p{N}_]";
const SPACE = "\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const PLACEHOLDER = /\{\{[^}]+\}\}|\{emote:[^}]+\}|\$t\([^)]+\)/gu;
const DIRECT_SPEECH_VERB = new RegExp(
	`(?<!${WORD})(?:dit-il|dit-elle|s'exclame-t-il|s'exclame-t-elle|s'écrie-t-il|répond-il|répond-elle|lance-t-il|lance-t-elle|ajoute-t-il|ajoute-t-elle)(?!${WORD})`,
	"u"
);
const NAMED_CONDITION = new RegExp(
	`(?<!${WORD})(?:Votre|Vos) (?:agilité|réputation|aura|force|vitesse|niveau|karma|expérience)(?!${WORD})`,
	"u"
);
const MISSING_SPACE = new RegExp(`[^${SPACE}][!?;:]`, "u");
const TRAILING_SPACES = new RegExp(`[${SPACE}]+$`, "u");
const BLANK = new RegExp(`^[${SPACE}]*$`, "u");
const CHOICE_SHORT_LENGTH = 40;

/**
 * Collected problems of an event: errors block the rewrite, warnings are advice
 * @typedef {{errors: string[], warnings: string[]}} Report
 */

/**
 * Style rules of a text: each one reports an error or a warning when its test matches
 * @type {{level: "errors" | "warnings", test: (text: string, kind: string) => boolean, message: string}[]}
 */
const TEXT_RULES = [
	{
		level: "errors", test: text => /[«»"“”]/u.test(text), message: "quotes (no direct speech)"
	},
	{
		level: "errors", test: text => DIRECT_SPEECH_VERB.test(text), message: "direct speech verb"
	},
	{
		level: "errors", test: text => text.includes("’"), message: "curly apostrophe"
	},
	{
		level: "errors", test: text => text.includes("—"), message: "em dash"
	},
	{
		level: "warnings", test: text => MISSING_SPACE.test(text.replace(/\{[^}]*\}|\$t\([^)]*\)/gu, "")), message: "missing space before ! ? ; :"
	},
	{
		level: "warnings", test: text => text.split("!").length - 1 > 1, message: "more than one !"
	},
	{
		level: "warnings", test: text => NAMED_CONDITION.test(text), message: "names the condition instead of showing it"
	},
	{
		level: "errors", test: (text, kind) => kind === "intro" && /(?:\.\.\.|…)$/u.test(text.replace(TRAILING_SPACES, "")), message: "intro ends with ellipsis"
	},
	{
		level: "warnings", test: (text, kind) => kind === "choice" && /^(?:Essayer|Tenter) d/u.test(text), message: "the choice aims at success, not an attempt (Faire fuir, not Essayer de faire fuir)"
	},
	{
		level: "warnings", test: (text, kind) => kind === "choice" && /quand même/u.test(text), message: "the choice judges itself (quand même): say the action only"
	},
	{
		level: "warnings", test: (text, kind) => kind === "choice" && [...text].length > CHOICE_SHORT_LENGTH, message: `choice longer than ${CHOICE_SHORT_LENGTH} chars: keep the details for the outcome`
	},
	{
		level: "warnings", test: text => /(?<!\p{L})retard(?!\p{L})/u.test(text), message: "\"retard\": the player has no schedule"
	},
	{
		level: "warnings", test: text => /encore et encore|de plus en plus fort/u.test(text), message: "escalation (encore et encore, de plus en plus fort): the player reacts at once"
	},
	{
		level: "warnings", test: text => text.split(/[.!?]/u).some(sentence => (sentence.match(/(?<!\p{L})puis(?!\p{L})/gu) ?? []).length >= 3), message: "three puis in one sentence: two at most"
	}
];

/**
 * Check the style and the length of a text, and that it keeps the placeholders of the original one
 * @param {Report} report
 * @param {string} path
 * @param {unknown} text
 * @param {{ref?: string, kind?: "intro" | "choice" | "outcome"}} reference original text and kind of text
 */
function checkText(report, path, text, { ref = "", kind = "outcome" } = {}) {
	if (typeof text !== "string" || BLANK.test(text)) {
		report.errors.push(`${path}: empty text`);
		return;
	}
	for (const placeholder of new Set((ref || "").match(PLACEHOLDER) ?? [])) {
		if (!text.includes(placeholder)) {
			report.errors.push(`${path}: placeholder ${placeholder} missing`);
		}
	}
	for (const rule of TEXT_RULES.filter(textRule => textRule.test(text, kind))) {
		report[rule.level].push(`${path}: ${rule.message}`);
	}
	const [low, high] = TEXT_LENGTHS[kind];
	const length = [...text].length;
	if (length < low || length > high) {
		report.warnings.push(`${path}: ${length} chars (reasonable ${low}-${high})`);
	}
}

/**
 * Check the texts: intro, choice labels and outcomes, against the original ones
 * @param {Report} report
 * @param {any} out writer output
 * @param {any} orig original event
 */
export function checkTexts(report, out, orig) {
	const origPossibilities = need(orig, "possibilities");
	checkText(report, "text", get(out, "text"), {
		ref: need(orig, "text"), kind: "intro"
	});
	const tp = get(out, "possibilities", {});
	const missing = difference(keysOf(origPossibilities), keysOf(tp));
	if (missing.size > 0) {
		report.errors.push(`original possibilities removed: ${pyRepr([...missing].sort(byCodePoint))}`);
	}
	if (difference(keysOf(tp), keysOf(origPossibilities)).size > 2) {
		report.warnings.push("more than 2 new possibilities");
	}
	for (const [name, possibility] of entriesOf(tp)) {
		const origPossibility = get(origPossibilities, name, {});
		if (name !== "end") {
			checkText(report, `${name}.text`, get(possibility, "text"), {
				ref: get(origPossibility, "text", ""), kind: "choice"
			});
		}
		else if (truthy(get(possibility, "text"))) {
			report.errors.push("end.text: the end possibility has no choice label");
		}
		for (const [outcome, text] of entriesOf(get(possibility, "outcomes", {}))) {
			checkText(report, `${name}.outcomes.${outcome}`, text, { ref: get(get(origPossibility, "outcomes", {}), outcome, "") });
		}
	}
}

