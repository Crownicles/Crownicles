import { KingChallengeReward } from "ws-packets/src/objects/KingChallenge";
import { i18n } from "@/src/translations/i18n";
import {
	AMOUNT_UNITS, formatAmount, formatMoney
} from "@/src/display/Amounts";
import { joinFacts } from "@/src/display/Facts";
import { formatDurationMinutes } from "@/src/display/ItemEffects";

const MILLISECONDS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 1_440;
const MINUTES_PER_HOUR = 60;

/** The tiers are numbered from the first; the last one, the champion's, stands outside the ladder and is named instead. */
export function kingChallengeTierLabel(index: number, tierCount: number): string {
	return index === tierCount - 1
		? i18n.t("app:kingChallenge.championTier")
		: i18n.t("app:kingChallenge.tier", { tier: index + 1 });
}

/** What a tier pays, each amount with the emoji of its unit; an empty share is left out. */
export function tierRewardFacts(reward: KingChallengeReward): string {
	return joinFacts([
		reward.money > 0 && formatMoney(reward.money),
		reward.tokens > 0 && formatAmount(reward.tokens, AMOUNT_UNITS.TOKEN),
		reward.gems > 0 && formatAmount(reward.gems, AMOUNT_UNITS.GEM)
	]);
}

/** A wait of several days is counted in days and hours, the last day in hours and minutes. */
export function formatTimeLeft(milliseconds: number): string {
	const minutes = Math.max(0, Math.ceil(milliseconds / MILLISECONDS_PER_MINUTE));
	if (minutes < MINUTES_PER_DAY) {
		return formatDurationMinutes(minutes);
	}
	const days = Math.floor(minutes / MINUTES_PER_DAY);
	const hours = Math.floor((minutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
	return hours === 0
		? i18n.t("app:adventure.duration.days", { count: days })
		: i18n.t("app:adventure.duration.daysHours", {
			days, hours
		});
}
