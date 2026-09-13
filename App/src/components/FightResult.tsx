import {ReactNode} from "react";
import {StyleSheet, Text, View} from "react-native";
import {Coins, Flag, Medal, Trophy, Swords} from "@/src/design/FightIcons";
import {FightEnd, FightReward} from "ws-packets/src/objects/Fight";
import {KeyValue, Note, Panel} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {formatNumber} from "@/src/display/Amounts";
import {fighterName} from "@/src/display/Fight";
import {i18n} from "@/src/translations/i18n";

const styles = StyleSheet.create({
	result: {alignItems: "center", paddingTop: 20, paddingBottom: 24, gap: 10},
	emblem: {width: 80, height: 80, alignItems: "center", justifyContent: "center", backgroundColor: Theme.colors.wash, borderRadius: 22, marginBottom: 4},
	resultTitle: {fontFamily: Theme.fonts.extraBold, fontSize: 30, lineHeight: 36, color: Theme.colors.ink, textAlign: "center"},
	resultSubtitle: {fontFamily: Theme.fonts.regular, fontSize: 13, lineHeight: 20, color: Theme.colors.muted, textAlign: "center"},
	rewards: {flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: Theme.colors.line, paddingVertical: 20, marginBottom: 18},
	reward: {flex: 1, minWidth: 0, alignItems: "center", gap: 7, paddingHorizontal: 4},
	rewardValue: {fontFamily: Theme.fonts.extraBold, fontSize: 22, color: Theme.colors.ink, fontVariant: ["tabular-nums"]},
	rewardLabel: {fontFamily: Theme.fonts.medium, fontSize: 11, color: Theme.colors.muted},
	resultDetails: {gap: 10}
});

function FightRewards({reward}: {reward: FightReward}): ReactNode {
	const ranking = reward.player1.isSelf ? reward.player1 : reward.player2;
	const gloryChange = ranking.newGlory - ranking.oldGlory;
	return <>
		<View style={styles.rewards}>
			<View style={styles.reward}><Medal size={23} color={Theme.colors.gold} /><Text style={[styles.rewardValue, {color: gloryChange < 0 ? Theme.colors.red : Theme.colors.green}]}>{gloryChange > 0 ? "+" : ""}{formatNumber(gloryChange)}</Text><Text style={styles.rewardLabel}>{i18n.t("app:arena.glory")}</Text></View>
			<View style={styles.reward}><Coins size={23} color={Theme.colors.gold} /><Text style={styles.rewardValue}>{formatNumber(reward.money)}</Text><Text style={styles.rewardLabel}>{i18n.t("app:profile.fields.money")}</Text></View>
			<View style={styles.reward}><Flag size={23} color={Theme.colors.blue} /><Text style={styles.rewardValue}>{formatNumber(reward.points)}</Text><Text style={styles.rewardLabel}>{i18n.t("app:profile.fields.score")}</Text></View>
		</View>
		<View style={styles.resultDetails}>
			<KeyValue label={i18n.t("app:arena.glory")} value={i18n.t("app:arena.gloryChange", {before: ranking.oldGlory, after: ranking.newGlory})} />
			<KeyValue label={i18n.t("app:arena.league")} value={i18n.t(`models:leagues.${ranking.newLeagueId}`)} />
		</View>
		{reward.petLoveChange ? <Note>{i18n.t("app:arena.petLove", {count: reward.petLoveChange.loveChange})}</Note> : null}
	</>;
}

export function FightResult({result, reward}: {result: FightEnd; reward: FightReward | null}): ReactNode {
	const opponent = result.winner.isSelf ? result.loser : result.winner;
	const won = !result.draw && result.winner.isSelf;
	const Icon = won ? Trophy : Swords;
	return <>
		<View style={styles.result}><View style={styles.emblem}><Icon size={43} color={won ? Theme.colors.gold : Theme.colors.muted} /></View><Text style={styles.resultTitle}>{i18n.t(result.draw ? "app:arena.draw" : won ? "app:arena.victory" : "app:arena.defeat")}</Text><Text style={styles.resultSubtitle}>{i18n.t("app:battle.finishedAgainst", {opponent: fighterName(opponent), turns: result.turns})}</Text></View>
		{reward ? <FightRewards reward={reward} /> : null}
		<Panel>
			<KeyValue label={i18n.t("app:arena.turns")} value={formatNumber(result.turns)} />
			{[result.winner, result.loser].map(fighter => <KeyValue key={fighter.isSelf ? "self" : "opponent"} label={fighterName(fighter)} value={i18n.t("app:profile.formats.progress", {value: fighter.finalEnergy, max: fighter.maxEnergy})} />)}
		</Panel>
	</>;
}