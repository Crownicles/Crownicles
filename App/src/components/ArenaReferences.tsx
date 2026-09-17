import {ReactNode, useState} from "react";
import {StyleSheet, Text, View} from "react-native";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {FightHistoryReq, LeagueInfoReq, LeagueRewardReq} from "ws-packets/src/fromClient/RankingsReq";
import {FightHistoryRes, LeagueInfoRes, LeagueRewardRes} from "ws-packets/src/fromServer/fight/RankingsRes";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {EloGameResult, FightHistoryEntry, LeagueInfo} from "ws-packets/src/objects/Rankings";
import {CommandMenu, useCommandMenus} from "@/src/store/useInventoryMenus";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GameClient} from "@/src/networking/GameClient";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {Button, ButtonRow, KeyValue, Note, Panel, Row, SectionHeader} from "@/src/design/Primitives";
import {Shield, Swords} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {AppIcons} from "@/src/AppIcons";
import {formatMoney, formatNumber, formatSignedNumber} from "@/src/display/Amounts";
import {missionDate} from "@/src/display/Missions";
import {i18n} from "@/src/translations/i18n";

const RESULT_LABELS = {[EloGameResult.WIN]: "app:arena.victory", [EloGameResult.LOSS]: "app:arena.defeat", [EloGameResult.DRAW]: "app:arena.draw"} as const;
const RESULT_COLORS = {[EloGameResult.WIN]: Theme.colors.green, [EloGameResult.LOSS]: Theme.colors.red, [EloGameResult.DRAW]: Theme.colors.muted} as const;
const REWARD_MENU: CommandMenu = {request: LeagueRewardReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [LeagueRewardRes]};
const styles = StyleSheet.create({
	history: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.md, paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.lg, minHeight: 64},
	emblem: {width: 38, height: 38, borderRadius: 12, backgroundColor: Theme.colors.wash, alignItems: "center", justifyContent: "center"},
	body: {flex: 1, minWidth: 0, gap: 3},
	title: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowTitle, color: Theme.colors.ink},
	meta: {flexDirection: "row", alignItems: "center", gap: 5},
	result: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowSubtitle, lineHeight: Theme.lineHeight.rowSubtitle},
	metaText: {flex: 1, fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.rowSubtitle, lineHeight: Theme.lineHeight.rowSubtitle, color: Theme.colors.muted},
	leagueLabel: {flex: 1, fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowSubtitle, lineHeight: Theme.lineHeight.rowSubtitle},
	end: {alignItems: "flex-end", alignSelf: "flex-start", paddingTop: 1},
	glory: {flexDirection: "row", alignItems: "center", gap: 4},
	gloryValue: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.title, fontVariant: ["tabular-nums"]}
});

function HistoryLeagueChange({change}: {change: {oldLeague: number; newLeague: number}}): ReactNode {
	const promoted = change.newLeague > change.oldLeague;
	const icon = AppIcons.getIconOrNull(`leagues.${change.newLeague}`);
	return <View style={styles.meta}>
		{icon ? <TwemojiIcon emoji={icon} size={12} /> : null}
		<Text style={[styles.leagueLabel, {color: promoted ? Theme.colors.green : Theme.colors.red}]} numberOfLines={1}>
			{i18n.t(`models:leagues.${change.newLeague}`)}
		</Text>
	</View>;
}

function HistoryEntry({entry}: {entry: FightHistoryEntry}): ReactNode {
	const league = entry.glory.leaguesChanges.me;
	const classIcon = AppIcons.getIconOrNull(`classes.${entry.classes.opponent}`);
	const gloryIcon = AppIcons.getIconOrNull("unitValues.glory");
	const Icon = entry.initiator ? Swords : Shield;
	const opponent = entry.opponentName ?? i18n.t("app:arena.opponent");
	return <View style={styles.history}>
		<View style={styles.emblem}><Icon size={18} color={Theme.colors.muted} /></View>
		<View style={styles.body}>
			<Text style={styles.title} numberOfLines={1}>{opponent}</Text>
			<Text style={[styles.result, {color: RESULT_COLORS[entry.result]}]}>{i18n.t(RESULT_LABELS[entry.result])}</Text>
			<View style={styles.meta}>
				{classIcon ? <TwemojiIcon emoji={classIcon} size={12} /> : null}
				<Text style={styles.metaText} numberOfLines={1}>{i18n.t(`models:classes.${entry.classes.opponent}`)} · {missionDate(entry.date)}</Text>
			</View>
			{league ? <HistoryLeagueChange change={league} /> : null}
		</View>
		<View style={styles.end}>
			<View style={styles.glory}>
				<Text style={[styles.gloryValue, {color: RESULT_COLORS[entry.result]}]}>{formatSignedNumber(entry.glory.change.me)}</Text>
				{gloryIcon ? <TwemojiIcon emoji={gloryIcon} size={12} /> : null}
			</View>
		</View>
	</View>;
}

function historyMonth(date: number): string {
	return new Intl.DateTimeFormat(i18n.language, {month: "long", year: "numeric"}).format(date);
}

function groupHistoryByMonth(history: FightHistoryEntry[]): {label: string; entries: FightHistoryEntry[]}[] {
	const groups = new Map<string, FightHistoryEntry[]>();
	for (const entry of history) {
		const label = historyMonth(entry.date);
		groups.set(label, [...(groups.get(label) ?? []), entry]);
	}
	return [...groups].map(([label, entries]) => ({label, entries}));
}

export function FightHistoryContent({history}: {history: FightHistoryEntry[]}): ReactNode {
	if (!history.length) return <Note>{i18n.t("app:arena.history.empty")}</Note>;
	return <>{groupHistoryByMonth(history).map((group, index) => <View key={group.label}>
		<SectionHeader first={index === 0}>{group.label}</SectionHeader>
		<Panel>{group.entries.map(entry => <HistoryEntry key={entry.id} entry={entry} />)}</Panel>
	</View>)}</>;
}

export function FightHistory(): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.FIGHT_HISTORY, () => GameClient.request(makeFromClientPacket(FightHistoryReq, {}), FightHistoryRes));
	return <GameQueryContent state={state} entity={GAME_ENTITIES.FIGHT_HISTORY}>{packet => <FightHistoryContent history={packet.history} />}</GameQueryContent>;
}

function LeagueRewards({league}: {league: LeagueInfo}): ReactNode {
	return <Panel>
		<KeyValue label={i18n.t("app:arena.leagues.threshold")} value={formatNumber(league.minGloryPoints)} />
		<KeyValue label={i18n.t("app:arena.leagues.seasonMoney")} value={formatMoney(league.money)} />
		<KeyValue label={i18n.t("app:arena.leagues.seasonXp")} value={formatNumber(league.xp)} />
		<KeyValue label={i18n.t("app:arena.leagues.winMoney")} value={formatMoney(league.winMoney)} />
	</Panel>;
}

export function LeaguesContent({data}: {data: LeagueInfoRes}): ReactNode {
	const [selected, setSelected] = useState(data.currentLeagueId);
	const {pending, message, open} = useCommandMenus();
	const league = data.leagues.find(entry => entry.id === selected);
	return <>
		<SectionHeader>{i18n.t(`models:leagues.${data.currentLeagueId}`)}</SectionHeader>
		<Panel><KeyValue label={i18n.t("app:arena.glory")} value={formatNumber(data.glory)} /></Panel>
		<ButtonRow><Button variant="primary" disabled={pending} onPress={(): Promise<void> => open(REWARD_MENU)}>{i18n.t("app:arena.leagues.claim")}</Button></ButtonRow>
		{message ? <Note>{message}</Note> : null}
		<SectionHeader>{i18n.t("app:arena.leagues.catalog")}</SectionHeader>
		<Panel>{data.leagues.map(entry => <Row key={entry.id} title={i18n.t(`models:leagues.${entry.id}`)} end={formatNumber(entry.minGloryPoints)} onPress={(): void => setSelected(entry.id)} chevron />)}</Panel>
		{league ? <><SectionHeader>{i18n.t(`models:leagues.${league.id}`)}</SectionHeader><LeagueRewards league={league} /></> : null}
	</>;
}

export function Leagues(): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.LEAGUES, () => GameClient.request(makeFromClientPacket(LeagueInfoReq, {}), LeagueInfoRes));
	return <GameQueryContent state={state} entity={GAME_ENTITIES.LEAGUES}>{packet => <LeaguesContent data={packet} />}</GameQueryContent>;
}
