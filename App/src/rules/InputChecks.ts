import {findTextIssue, normalizeText, TEXT_ISSUES, TextIssue, TextRule, TextRuleId} from "ws-packets/src/objects/TextRules";
import type {NumberRange} from "ws-packets/src/objects/GameRules";
import type {Lock} from "@/src/design/Sections";
import {formatNumber} from "@/src/display/Amounts";
import {gameRules} from "@/src/rules/GameRules";
import {i18n} from "@/src/translations/i18n";

/** What a field holds once read as the server expects it, and why it cannot be sent yet. */
export type CheckedInput<T> = {value: T; lock: Lock | null};

/** Any rank of the general ranking: the server tells whether a player holds it. */
export const RANK_RANGE: NumberRange = {min: 1, max: Number.MAX_SAFE_INTEGER};

function textIssueReason(issue: TextIssue, rule: TextRule): string {
	const character = issue.kind === TEXT_ISSUES.FORBIDDEN_CHARACTER ? {character: issue.character} : {};
	return i18n.t(`app:inputIssues.${issue.kind}`, {min: rule.min, max: rule.max, ...character});
}

/** A typed text, as Core will keep it, checked against the rule Core applies to that field. */
export function checkText(input: string, ruleId: TextRuleId): CheckedInput<string> {
	const rule = gameRules().textRules[ruleId];
	const value = normalizeText(input);
	const issue = findTextIssue(value, rule);
	return {value, lock: issue ? {reason: textIssueReason(issue, rule)} : null};
}

function numberIssueReason(value: number, range: NumberRange): string | null {
	if (!Number.isSafeInteger(value)) return i18n.t("app:inputIssues.notWholeNumber");
	if (value < range.min) return i18n.t("app:inputIssues.belowMin", {min: formatNumber(range.min)});
	return value > range.max ? i18n.t("app:inputIssues.aboveMax", {max: formatNumber(range.max)}) : null;
}

/** A typed whole number, checked against inclusive bounds. */
export function checkWholeNumber(input: string, range: NumberRange): CheckedInput<number> {
	const value = input.trim() === "" ? Number.NaN : Number(input);
	const reason = numberIssueReason(value, range);
	return {value, lock: reason ? {reason} : null};
}
