import {ReactNode, useState} from "react";
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from "react-native";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {FightHistoryReq, LeagueInfoReq, LeagueRewardReq} from "ws-packets/src/fromClient/RankingsReq";
import {FightHistoryRes, LeagueInfoRes, LeagueRewardRes} from "ws-packets/src/fromServer/fight/RankingsRes";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {EloGameResult, FightHistoryEntry, LeagueInfo, LeagueRewardAvailability} from "ws-packets/src/objects/Rankings";
import {CommandMenu, useCommandMenus} from "@/src/store/useInventoryMenus";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GameClient} from "@/src/networking/GameClient";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {FightGauge} from "@/src/components/FightGauge";
import {Note, Panel, SectionHeader} from "@/src/design/Primitives";
import {ArrowRight, ChevronDown, Clock3, Medal, Shield, Swords, Trophy} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {AppIcons} from "@/src/AppIcons";
import {formatNumber, formatSignedNumber} from "@/src/display/Amounts";
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
	gloryValue: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.title, fontVariant: ["tabular-nums"]},
	leagueStanding: {paddingBottom: Theme.spacing.xl, gap: Theme.spacing.lg},
	leagueIdentity: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.lg},
	leagueEmblem: {width: 64, height: 64, flexShrink: 0, alignItems: "center", justifyContent: "center", backgroundColor: Theme.colors.wash, borderRadius: 8},
	leagueTitle: {fontFamily: Theme.fonts.extraBold, fontSize: 23, lineHeight: 29, color: Theme.colors.ink, flexShrink: 1},
	leagueCaption: {fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: Theme.colors.muted},
	leagueGlory: {flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: Theme.spacing.sm},
	leagueGloryAmount: {fontFamily: Theme.fonts.extraBold, fontSize: 28, lineHeight: 34, color: Theme.colors.ink, fontVariant: ["tabular-nums"]},
	leagueClaim: {minHeight: 52, paddingHorizontal: Theme.spacing.xl, paddingVertical: Theme.spacing.md, borderRadius: Theme.pillRadius, backgroundColor: Theme.colors.ink, flexDirection: "row", alignItems: "center", gap: Theme.spacing.md},
	leagueClaimLabel: {flex: 1, fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.button, lineHeight: Theme.lineHeight.body, color: Theme.colors.paper},
	leagueClaimIcon: {width: 20, height: 20, alignItems: "center", justifyContent: "center"},
	leagueDisabled: {opacity: 0.5},
	leagueUnavailable: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.sm, paddingTop: Theme.spacing.md},
	leagueUnavailableText: {flex: 1, fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: Theme.colors.muted},
	leaguePressed: {opacity: 0.7},
	leagueList: {borderTopWidth: 1, borderColor: Theme.colors.line},
	leagueEntry: {borderBottomWidth: 1, borderColor: Theme.colors.line},
	leagueChoice: {minHeight: 76, flexDirection: "row", alignItems: "center", gap: Theme.spacing.md, paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.md, borderLeftWidth: 3, borderLeftColor: "transparent"},
	leagueSelected: {backgroundColor: Theme.colors.wash},
	leagueCurrent: {borderLeftColor: Theme.colors.green},
	leagueLocked: {opacity: 0.45},
	leagueChoiceEmblem: {width: 32, height: 32, flexShrink: 0, alignItems: "center", justifyContent: "center"},
	leagueName: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowTitle, lineHeight: Theme.lineHeight.body, color: Theme.colors.ink},
	leagueThreshold: {alignItems: "flex-end", maxWidth: "35%", gap: 3, flexShrink: 1},
	leagueThresholdValue: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.rowTitle, color: Theme.colors.ink, fontVariant: ["tabular-nums"], flexShrink: 1},
	leagueYou: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.caption, color: Theme.colors.green},
	leagueChevronOpen: {transform: [{rotate: "180deg"}]},
	leagueRewards: {backgroundColor: Theme.colors.wash, paddingHorizontal: Theme.spacing.lg, paddingBottom: Theme.spacing.lg, gap: Theme.spacing.md},
	leagueSeasonRewards: {flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.lg, paddingTop: Theme.spacing.md, borderTopWidth: 1, borderColor: Theme.colors.line},
	leagueReward: {flex: 1, minWidth: 100, gap: 6},
	leagueRewardAmount: {fontFamily: Theme.fonts.bold, fontSize: 21, lineHeight: 27, color: Theme.colors.ink, fontVariant: ["tabular-nums"], flexShrink: 1},
	leagueWinReward: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.md, paddingTop: Theme.spacing.md, borderTopWidth: 1, borderColor: Theme.colors.line},
	leagueWinLabel: {flex: 1, fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: Theme.colors.muted}
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

function LeagueEmblem({leagueId, size}: {leagueId: number; size: number}): ReactNode {
	const icon = AppIcons.getIconOrNull(`leagues.${leagueId}`);
	return icon ? <TwemojiIcon emoji={icon} size={size} /> : <Medal size={size} color={Theme.colors.gold} />;
}

/** The arena speaks the game's own vocabulary: its units wear the emojis the rest of the game uses. */
function UnitIcon({unit, size}: {unit: string; size: number}): ReactNode {
	const icon = AppIcons.getIconOrNull(`unitValues.${unit}`);
	return icon ? <TwemojiIcon emoji={icon} size={size} /> : null;
}

function LeagueStanding({data, next}: {data: LeagueInfoRes; next?: LeagueInfo}): ReactNode {
	return <View style={styles.leagueStanding} testID="league-standing">
		<View style={styles.leagueIdentity}>
			<View style={styles.leagueEmblem}><LeagueEmblem leagueId={data.currentLeagueId} size={40} /></View>
			<View style={styles.body}>
				<Text style={styles.leagueCaption}>{i18n.t("app:arena.league")}</Text>
				<Text style={styles.leagueTitle}>{i18n.t(`models:leagues.${data.currentLeagueId}`)}</Text>
			</View>
		</View>
		<View style={styles.leagueGlory}>
			<Text style={styles.leagueCaption}>{i18n.t("app:arena.glory")}</Text>
			<View style={styles.glory}><Text style={styles.leagueGloryAmount}>{formatNumber(data.glory)}</Text><UnitIcon unit="glory" size={20} /></View>
		</View>
		{next ? <FightGauge label={i18n.t(`models:leagues.${next.id}`)} value={data.glory} max={next.minGloryPoints} color={Theme.colors.green} /> : null}
	</View>;
}

function LeagueRewards({league}: {league: LeagueInfo}): ReactNode {
	return <View style={styles.leagueRewards} testID={`league-rewards-${league.id}`}>
		<View style={styles.leagueSeasonRewards}>
			<View style={styles.leagueReward}>
				<UnitIcon unit="money" size={19} />
				<Text style={styles.leagueRewardAmount}>{formatNumber(league.money)}</Text>
				<Text style={styles.leagueCaption}>{i18n.t("app:arena.leagues.seasonMoney")}</Text>
			</View>
			<View style={styles.leagueReward}>
				<UnitIcon unit="xp" size={19} />
				<Text style={styles.leagueRewardAmount}>{formatNumber(league.xp)}</Text>
				<Text style={styles.leagueCaption}>{i18n.t("app:arena.leagues.seasonXp")}</Text>
			</View>
		</View>
		<View style={styles.leagueWinReward}>
			<UnitIcon unit="attack" size={15} />
			<Text style={styles.leagueWinLabel}>{i18n.t("app:arena.leagues.winMoney")}</Text>
			<View style={styles.glory}><Text style={styles.leagueThresholdValue}>{formatNumber(league.winMoney)}</Text><UnitIcon unit="money" size={14} /></View>
		</View>
	</View>;
}

type LeagueChoiceProps = {league: LeagueInfo; current: boolean; locked: boolean; selected: boolean; onSelect: (id: number) => void};

function LeagueThreshold({league, current}: {league: LeagueInfo; current: boolean}): ReactNode {
	return <View style={styles.leagueThreshold}>
		<View style={styles.glory}><Text style={styles.leagueThresholdValue}>{formatNumber(league.minGloryPoints)}</Text><UnitIcon unit="glory" size={12} /></View>
		{current ? <Text style={styles.leagueYou}>{i18n.t("app:arena.you")}</Text> : null}
	</View>;
}

function LeagueChoice({league, current, locked, selected, onSelect}: LeagueChoiceProps): ReactNode {
	return <View style={styles.leagueEntry}>
		<Pressable accessibilityRole="button" accessibilityLabel={i18n.t(`models:leagues.${league.id}`)} accessibilityState={{selected, expanded: selected}} onPress={(): void => onSelect(league.id)} style={({pressed}) => [styles.leagueChoice, selected && styles.leagueSelected, current && styles.leagueCurrent, locked && !selected && styles.leagueLocked, pressed && styles.leaguePressed]}>
			<View style={styles.leagueChoiceEmblem}><LeagueEmblem leagueId={league.id} size={26} /></View>
			<View style={styles.body}>
				<Text style={styles.leagueName}>{i18n.t(`models:leagues.${league.id}`)}</Text>
				<Text style={styles.leagueCaption}>{i18n.t("app:arena.leagues.threshold")}</Text>
			</View>
			<LeagueThreshold league={league} current={current} />
			<View style={selected && styles.leagueChevronOpen}><ChevronDown size={16} color={Theme.colors.muted} /></View>
		</Pressable>
		{selected ? <LeagueRewards league={league} /> : null}
	</View>;
}

function unavailabilityLabel(availability: NonNullable<LeagueRewardAvailability>): string {
	return availability.type === "notSunday"
		? i18n.t("app:arena.leagues.nextClaim", {date: missionDate(availability.nextSunday)})
		: i18n.t(`app:arena.leagues.${availability.type}`);
}

function LeagueClaimButton({pending, availability, onClaim}: {pending: boolean; availability: LeagueRewardAvailability; onClaim: () => Promise<void>}): ReactNode {
	const blocked = Boolean(availability);
	return <View>
		<Pressable accessibilityRole="button" accessibilityState={{disabled: pending || blocked, busy: pending}} disabled={pending || blocked} onPress={onClaim} style={({pressed}) => [styles.leagueClaim, (pending || blocked) && styles.leagueDisabled, pressed && styles.leaguePressed]}>
			<View style={styles.leagueClaimIcon}>{pending ? <ActivityIndicator size="small" color={Theme.colors.paper} /> : <Trophy size={20} color={Theme.colors.paper} />}</View>
			<Text style={styles.leagueClaimLabel}>{i18n.t("app:arena.leagues.claim")}</Text>
			<ArrowRight size={18} color={Theme.colors.paper} />
		</Pressable>
		{availability ? <View style={styles.leagueUnavailable} testID="league-reward-unavailable">
			<Clock3 size={14} color={Theme.colors.muted} />
			<Text style={styles.leagueUnavailableText}>{unavailabilityLabel(availability)}</Text>
		</View> : null}
	</View>;
}

export function LeaguesContent({data}: {data: LeagueInfoRes}): ReactNode {
	const [selected, setSelected] = useState<number | undefined>(data.currentLeagueId);
	const {pending, message, open} = useCommandMenus();
	const leagues = [...data.leagues].sort((first, second) => first.minGloryPoints - second.minGloryPoints);
	const current = leagues.find(league => league.id === data.currentLeagueId);
	const next = current ? leagues.find(league => league.minGloryPoints > current.minGloryPoints) : undefined;
	const selectLeague = (id: number): void => setSelected(previous => previous === id ? undefined : id);
	return <>
		<LeagueStanding data={data} {...next ? {next} : {}} />
		<LeagueClaimButton pending={pending} availability={data.rewardAvailability} onClaim={(): Promise<void> => open(REWARD_MENU)} />
		{message ? <Note>{message}</Note> : null}
		<SectionHeader>{i18n.t("app:arena.leagues.catalog")}</SectionHeader>
		<View style={styles.leagueList}>{leagues.map(league => <LeagueChoice key={league.id} league={league} current={league.id === data.currentLeagueId} locked={league.minGloryPoints > data.glory} selected={league.id === selected} onSelect={selectLeague} />)}</View>
	</>;
}

export function Leagues(): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.LEAGUES, () => GameClient.request(makeFromClientPacket(LeagueInfoReq, {}), LeagueInfoRes));
	return <GameQueryContent state={state} entity={GAME_ENTITIES.LEAGUES}>{packet => <LeaguesContent data={packet} />}</GameQueryContent>;
}
