import {
	KingChallengeReward, KingChallengeRules
} from "ws-packets/src/objects/KingChallenge";
import { KingChallengeTierReachedRes } from "ws-packets/src/fromServer/missions/KingChallengeTierReachedRes";
import { i18n } from "@/src/translations/i18n";
import {
	AMOUNT_UNITS, formatAmount, formatMoney, formatNumber
} from "@/src/display/Amounts";
import { joinFacts } from "@/src/display/Facts";
import {
	formatLongDurationMinutes, MILLISECONDS_PER_MINUTE
} from "@/src/display/ItemEffects";

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

/** The wait before the challenge starts over, which can last several days. */
export function formatTimeLeft(milliseconds: number): string {
	return formatLongDurationMinutes(milliseconds / MILLISECONDS_PER_MINUTE);
}

/** Core pays no token to a player who already held the cap, though the tiers crossed list some. */
function tokensWithheld(reached: KingChallengeTierReachedRes, rules: KingChallengeRules): boolean {
	return reached.reward.tokens === 0
		&& reached.ownedTokens >= rules.tokenCap
		&& rules.tierRewards.slice(reached.tier - reached.crossedTiers, reached.tier).some(reward => reward.tokens > 0);
}

/** What a crossing paid, in words since a toast does not draw emojis, and why no token came when the cap held them back. */
export function tierReachedRewards(reached: KingChallengeTierReachedRes, rules: KingChallengeRules): string {
	const { reward } = reached;
	return joinFacts([
		reward.money > 0 && i18n.t("app:kingChallenge.toast.money", { amount: formatNumber(reward.money) }),
		reward.tokens > 0 && i18n.t("app:kingChallenge.toast.tokens", { amount: formatNumber(reward.tokens) }),
		reward.gems > 0 && i18n.t("app:kingChallenge.toast.gems", { amount: formatNumber(reward.gems) }),
		tokensWithheld(reached, rules) && i18n.t("app:kingChallenge.toast.tokensWithheld", { tokens: formatNumber(reached.ownedTokens) })
	]);
}
