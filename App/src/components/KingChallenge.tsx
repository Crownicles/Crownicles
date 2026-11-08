import { ReactNode } from "react";
import {
	Text, View
} from "react-native";
import {
	KingChallengeProgress, KingChallengeRules
} from "ws-packets/src/objects/KingChallenge";
import { AppIcons } from "@/src/AppIcons";
import {
	Note, SectionHeader
} from "@/src/design/Primitives";
import {
	EntryRow, ExpandableList, Fact, Figures, Gauge, LockHint, useSectionStyles
} from "@/src/design/Sections";
import { Coins } from "@/src/design/FightIcons";
import { TwemojiIcon } from "@/src/design/TwemojiIcon";
import { useColors } from "@/src/design/ThemeContext";
import { UnitIcon } from "@/src/components/UnitIcon";
import { formatNumber } from "@/src/display/Amounts";
import {
	formatTimeLeft, kingChallengeTierLabel, tierRewardFacts
} from "@/src/display/KingChallenge";
import { gameRules } from "@/src/rules/GameRules";
import { usePlayerProfile } from "@/src/store/usePlayerProfile";
import { i18n } from "@/src/translations/i18n";

const TIER_EMBLEM_SIZE = 26;
const THRESHOLD_UNIT_SIZE = 15;
const SCORE_UNIT = "score";

/** Where the week stands: the score gained, the tiers crossed, the next one and when the king starts over. */
function ChallengeProgress({
	progress, now
}: {
	progress: KingChallengeProgress; now: number;
}): ReactNode {
	const colors = useColors();
	const tierCount = progress.thresholds.length;
	const resetIn = i18n.t("app:kingChallenge.resetIn", { duration: formatTimeLeft(progress.nextResetDate - now) });
	const nextThreshold = progress.thresholds[progress.tier];
	return <>
		<Figures items={[
			{
				caption: i18n.t("app:kingChallenge.weeklyScore"), value: formatNumber(progress.weeklyScore), unit: SCORE_UNIT
			},
			{
				caption: i18n.t("app:kingChallenge.tiersReached"),
				value: i18n.t("app:profile.formats.progress", {
					value: progress.tier, max: tierCount
				})
			}
		]} />
		{nextThreshold === undefined
			? <Note>{i18n.t("commands:missions.kingChallenge.completed", { time: resetIn })}</Note>
			: <ExpandableList>
				<Gauge
					label={kingChallengeTierLabel(progress.tier, tierCount)}
					value={i18n.t("app:kingChallenge.scoreProgress", {
						value: progress.weeklyScore, max: nextThreshold
					})}
					ratio={progress.weeklyScore / nextThreshold}
					color={colors.gold}
				/>
				<Fact label={i18n.t("app:kingChallenge.reset")} value={resetIn} />
			</ExpandableList>}
	</>;
}

function TierThreshold({ threshold }: { threshold: number }): ReactNode {
	const sectionStyles = useSectionStyles();
	return <View style={sectionStyles.value}>
		<Text style={sectionStyles.amount}>{formatNumber(threshold)}</Text>
		<UnitIcon unit={SCORE_UNIT} size={THRESHOLD_UNIT_SIZE} />
	</View>;
}

/** Every tier with the score it asks and what it pays; the ones already crossed are set back. */
function TierLadder({
	progress, rules
}: {
	progress: KingChallengeProgress; rules: KingChallengeRules;
}): ReactNode {
	const tierCount = progress.thresholds.length;
	return <>
		<SectionHeader>{i18n.t("app:kingChallenge.tiers")}</SectionHeader>
		<ExpandableList>
			{progress.thresholds.map((threshold, index) => {
				const reached = index < progress.tier;
				const reward = rules.tierRewards[index];
				return <EntryRow
					key={kingChallengeTierLabel(index, tierCount)}
					emblem={<TwemojiIcon emoji={AppIcons.getIcon(reached ? "kingChallenge.tierReached" : "kingChallenge.tierPending")} size={TIER_EMBLEM_SIZE} />}
					title={kingChallengeTierLabel(index, tierCount)}
					{...reward ? { subtitle: tierRewardFacts(reward) } : {}}
					end={<TierThreshold threshold={threshold} />}
					disabled={reached}
				/>;
			})}
		</ExpandableList>
		<Note>{i18n.t("app:kingChallenge.championNote")}</Note>
	</>;
}

/** The tokens of a tier only come below the cap: the rule is always told, and so is a stock that already holds them back. */
function TokenRule({
	rules, ownedTokens, completed
}: {
	rules: KingChallengeRules; ownedTokens: number | undefined; completed: boolean;
}): ReactNode {
	const heldTokens = !completed && ownedTokens !== undefined && ownedTokens >= rules.tokenCap ? ownedTokens : null;
	return <>
		<Note>{i18n.t("app:kingChallenge.tokenRule", { tokenCap: rules.tokenCap })}</Note>
		{heldTokens === null
			? null
			: <LockHint
				lock={{
					reason: i18n.t("app:kingChallenge.tokensHeld", {
						tokens: formatNumber(heldTokens), tokenCap: rules.tokenCap
					}),
					icon: Coins
				}}
				testID="king-challenge-tokens-held"
			/>}
	</>;
}

/** The king's challenge of the week, as the server describes it; `ownedTokens` tells whether the cap holds the next tokens back. */
export function KingChallengeContent({
	progress, now, ownedTokens
}: {
	progress: KingChallengeProgress; now: number; ownedTokens?: number;
}): ReactNode {
	const rules = gameRules().kingChallenge;
	return <>
		<Note>{i18n.t("commands:missions.kingChallenge.description")}</Note>
		<ChallengeProgress progress={progress} now={now} />
		<TierLadder progress={progress} rules={rules} />
		<TokenRule rules={rules} ownedTokens={ownedTokens} completed={progress.tier >= progress.thresholds.length} />
	</>;
}

/** The missions' view of the king's challenge, with the tokens the profile says the player holds. */
export function KingChallenge({
	progress, now
}: {
	progress: KingChallengeProgress; now: number;
}): ReactNode {
	const profile = usePlayerProfile();
	const ownedTokens = profile.status === "ready" ? profile.data.tokens?.value : undefined;
	return <KingChallengeContent progress={progress} now={now} {...ownedTokens === undefined ? {} : { ownedTokens }} />;
}
