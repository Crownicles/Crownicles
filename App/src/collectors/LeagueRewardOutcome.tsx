import {ReactNode} from "react";
import {StyleSheet, View} from "react-native";
import {LeagueRewardOutcome as Outcome} from "ws-packets/src/objects/Rankings";
import {CelebrationModal} from "@/src/components/UnlockCelebration";
import {formatGlory, formatNumber} from "@/src/display/Amounts";
import {missionDate} from "@/src/display/Missions";
import {amountEffect, infoEffect, presentEffects} from "@/src/display/OutcomeEffects";
import {ActionBanner, Effect, Effects, Toast} from "@/src/design/Sections";
import {Check} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";

const styles = StyleSheet.create({
	rewards: {alignItems: "center", marginVertical: Theme.spacing.lg}
});

type Success = Extract<Outcome, {type: "success"}>;

function rewardEffects(outcome: Success): Effect[] {
	return presentEffects([
		infoEffect(i18n.t("app:profile.fields.rank"), formatNumber(outcome.rank)),
		infoEffect(i18n.t("app:arena.glory"), formatGlory(outcome.gloryPoints)),
		amountEffect(i18n.t("app:profile.fields.money"), outcome.money, {gain: "money"}),
		amountEffect(i18n.t("app:profile.fields.experience"), outcome.xp, {gain: "xp"}),
		amountEffect(i18n.t("app:profile.fields.score"), outcome.score, {gain: "score"})
	]);
}

/** Why the reward could not be claimed; the claim button already says it beforehand, this only covers stale data. */
function refusal(outcome: Exclude<Outcome, Success>): string {
	return outcome.type === "notSunday"
		? i18n.t("app:arena.leagues.nextClaim", {date: missionDate(outcome.nextSunday)})
		: i18n.t(`app:arena.leagues.${outcome.type}`);
}

/** The week's league reward is a moment: the league it was earned in, and what it brought, in bubbles. */
export function LeagueRewardOutcome({outcome, onContinue}: {outcome: Outcome; onContinue: () => void}): ReactNode {
	if (outcome.type !== "success") return <Toast title={i18n.t("app:arena.leagues.reward")} subtitle={refusal(outcome)} onDismiss={onContinue} />;
	return <CelebrationModal onClose={onContinue} icon={`leagues.${outcome.oldLeagueId}`} eyebrow={i18n.t("app:arena.leagues.reward")} title={i18n.t(`models:leagues.${outcome.oldLeagueId}`)} testID="league-reward">
		<View style={styles.rewards}><Effects items={rewardEffects(outcome)} /></View>
		<ActionBanner icon={Check} label={i18n.t("app:common.continue")} onPress={onContinue} />
	</CelebrationModal>;
}
