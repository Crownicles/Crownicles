import {ReactNode, useState} from "react";
import {Pressable, StyleProp, Text, View, ViewStyle} from "react-native";
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
import {UnitIcon} from "@/src/components/UnitIcon";
import {Note, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, ExpandableEntry, ExpandableList, Lock, useSectionStyles, Standing} from "@/src/design/Sections";
import {ChevronRight, Clock3, Medal, Shield, Swords, Trophy} from "@/src/design/FightIcons";
import {useOpenPlayer} from "@/src/navigation/OtherProfiles";
import {PaletteColor, Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {AppIcons} from "@/src/AppIcons";
import {formatNumber, formatSignedNumber} from "@/src/display/Amounts";
import {missionDate} from "@/src/display/Missions";
import {i18n} from "@/src/translations/i18n";
import {createStyles, useColors} from "@/src/design/ThemeContext";

const RESULT_LABELS = {[EloGameResult.WIN]: "app:arena.victory", [EloGameResult.LOSS]: "app:arena.defeat", [EloGameResult.DRAW]: "app:arena.draw"} as const;
const RESULT_COLORS = {[EloGameResult.WIN]: "green", [EloGameResult.LOSS]: "red", [EloGameResult.DRAW]: "muted"} as const satisfies Record<EloGameResult, PaletteColor>;
const REWARD_MENU: CommandMenu = {request: LeagueRewardReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [LeagueRewardRes]};
const useStyles = createStyles(colors => ({
	history: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.md, paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.lg, minHeight: 64},
	emblem: {width: 38, height: 38, borderRadius: 12, backgroundColor: colors.wash, alignItems: "center", justifyContent: "center"},
	body: {flex: 1, minWidth: 0, gap: 3},
	title: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowTitle, color: colors.ink},
	meta: {flexDirection: "row", alignItems: "center", gap: 5},
	result: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowSubtitle, lineHeight: Theme.lineHeight.rowSubtitle},
	metaText: {flex: 1, fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.rowSubtitle, lineHeight: Theme.lineHeight.rowSubtitle, color: colors.muted},
	leagueLabel: {flex: 1, fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowSubtitle, lineHeight: Theme.lineHeight.rowSubtitle},
	end: {alignItems: "flex-end", alignSelf: "flex-start", paddingTop: 1},
	glory: {flexDirection: "row", alignItems: "center", gap: 4},
	pressed: {opacity: 0.7},
	gloryValue: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.title, fontVariant: ["tabular-nums"]},
	leagueStanding: {paddingBottom: Theme.spacing.xl, gap: Theme.spacing.lg},
	leagueIdentity: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.lg},
	leagueEmblem: {width: 64, height: 64, flexShrink: 0, alignItems: "center", justifyContent: "center", backgroundColor: colors.wash, borderRadius: 8},
	leagueTitle: {fontFamily: Theme.fonts.extraBold, fontSize: 23, lineHeight: 29, color: colors.ink, flexShrink: 1},
	leagueCaption: {fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: colors.muted},
	leagueGlory: {flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: Theme.spacing.sm},
	leagueGloryAmount: {fontFamily: Theme.fonts.extraBold, fontSize: 28, lineHeight: 34, color: colors.ink, fontVariant: ["tabular-nums"]},
	leagueThreshold: {alignItems: "flex-end", maxWidth: "35%", gap: 3, flexShrink: 1},
	leagueThresholdValue: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.rowTitle, color: colors.ink, fontVariant: ["tabular-nums"], flexShrink: 1},
	leagueSeasonRewards: {flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.lg, paddingTop: Theme.spacing.md},
	leagueReward: {flex: 1, minWidth: 100, gap: 6},
	leagueRewardAmount: {fontFamily: Theme.fonts.bold, fontSize: 21, lineHeight: 27, color: colors.ink, fontVariant: ["tabular-nums"], flexShrink: 1},
	leagueWinReward: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.md, paddingTop: Theme.spacing.md},
	leagueWinLabel: {flex: 1, fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: colors.muted}
}));

function HistoryLeagueChange({change}: {change: {oldLeague: number; newLeague: number}}): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const promoted = change.newLeague > change.oldLeague;
	const icon = AppIcons.getIconOrNull(`leagues.${change.newLeague}`);
	return <View style={styles.meta}>
		{icon ? <TwemojiIcon emoji={icon} size={12} /> : null}
		<Text style={[styles.leagueLabel, {color: promoted ? colors.green : colors.red}]} numberOfLines={1}>
			{i18n.t(`models:leagues.${change.newLeague}`)}
		</Text>
	</View>;
}

/** A tap on a fight opens the opponent's profile, as a line of a ranking does. */
function HistoryEntry({entry}: {entry: FightHistoryEntry}): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const openPlayer = useOpenPlayer();
	const league = entry.glory.leaguesChanges.me;
	const classIcon = AppIcons.getIconOrNull(`classes.${entry.classes.opponent}`);
	const gloryIcon = AppIcons.getIconOrNull("unitValues.glory");
	const Icon = entry.initiator ? Swords : Shield;
	const opponent = entry.opponentName ?? i18n.t("error:unknownPlayer");
	return <Pressable
		accessibilityRole="button"
		accessibilityLabel={i18n.t("app:arena.rankings.openProfile", {name: opponent})}
		onPress={(): void => openPlayer(entry.opponentRef)}
		style={({pressed}): StyleProp<ViewStyle> => [styles.history, pressed && styles.pressed]}
	>
		<View style={styles.emblem}><Icon size={18} color={colors.muted} /></View>
		<View style={styles.body}>
			<Text style={styles.title} numberOfLines={1}>{opponent}</Text>
			<Text style={[styles.result, {color: colors[RESULT_COLORS[entry.result]]}]}>{i18n.t(RESULT_LABELS[entry.result])}</Text>
			<View style={styles.meta}>
				{classIcon ? <TwemojiIcon emoji={classIcon} size={12} /> : null}
				<Text style={styles.metaText} numberOfLines={1}>{i18n.t(`models:classes.${entry.classes.opponent}`)} · {missionDate(entry.date)}</Text>
			</View>
			{league ? <HistoryLeagueChange change={league} /> : null}
		</View>
		<View style={styles.end}>
			<View style={styles.glory}>
				<Text style={[styles.gloryValue, {color: colors[RESULT_COLORS[entry.result]]}]}>{formatSignedNumber(entry.glory.change.me)}</Text>
				{gloryIcon ? <TwemojiIcon emoji={gloryIcon} size={12} /> : null}
			</View>
		</View>
		<ChevronRight size={16} color={colors.faint} />
	</Pressable>;
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
		<ExpandableList>{group.entries.map(entry => <HistoryEntry key={entry.id} entry={entry} />)}</ExpandableList>
	</View>)}</>;
}

export function FightHistory(): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.FIGHT_HISTORY, () => GameClient.request(makeFromClientPacket(FightHistoryReq, {}), FightHistoryRes));
	return <GameQueryContent state={state} entity={GAME_ENTITIES.FIGHT_HISTORY}>{packet => <FightHistoryContent history={packet.history} />}</GameQueryContent>;
}

function LeagueEmblem({leagueId, size}: {leagueId: number; size: number}): ReactNode {
	const colors = useColors();
	const icon = AppIcons.getIconOrNull(`leagues.${leagueId}`);
	return icon ? <TwemojiIcon emoji={icon} size={size} /> : <Medal size={size} color={colors.gold} />;
}

function LeagueStanding({data, next}: {data: LeagueInfoRes; next?: LeagueInfo}): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	return <Standing
		testID="league-standing"
		emblem={<LeagueEmblem leagueId={data.currentLeagueId} size={40} />}
		caption={i18n.t("app:arena.league")}
		title={i18n.t(`models:leagues.${data.currentLeagueId}`)}
	>
		<View style={styles.leagueGlory}>
			<Text style={styles.leagueCaption}>{i18n.t("app:arena.glory")}</Text>
			<View style={styles.glory}><Text style={styles.leagueGloryAmount}>{formatNumber(data.glory)}</Text><UnitIcon unit="glory" size={20} /></View>
		</View>
		{next ? <FightGauge label={i18n.t(`models:leagues.${next.id}`)} value={data.glory} max={next.minGloryPoints} color={colors.green} /> : null}
	</Standing>;
}

function LeagueRewards({league}: {league: LeagueInfo}): ReactNode {
	const styles = useStyles();
	return <View testID={`league-rewards-${league.id}`}>
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
	const sectionStyles = useSectionStyles();
	const styles = useStyles();
	return <View style={styles.leagueThreshold}>
		<View style={styles.glory}><Text style={styles.leagueThresholdValue}>{formatNumber(league.minGloryPoints)}</Text><UnitIcon unit="glory" size={12} /></View>
		{current ? <Text style={sectionStyles.you}>{i18n.t("app:arena.you")}</Text> : null}
	</View>;
}

function LeagueChoice({league, current, locked, selected, onSelect}: LeagueChoiceProps): ReactNode {
	return <ExpandableEntry
		emblem={<LeagueEmblem leagueId={league.id} size={26} />}
		label={i18n.t(`models:leagues.${league.id}`)}
		caption={i18n.t("app:arena.leagues.threshold")}
		end={<LeagueThreshold league={league} current={current} />}
		expanded={selected}
		highlighted={current}
		dimmed={locked}
		onToggle={(): void => onSelect(league.id)}
	>
		<LeagueRewards league={league} />
	</ExpandableEntry>;
}

function claimLock(availability: LeagueRewardAvailability): Lock | undefined {
	if (!availability) return undefined;
	return {
		reason: availability.type === "notSunday"
			? i18n.t("app:arena.leagues.nextClaim", {date: missionDate(availability.nextSunday)})
			: i18n.t(`app:arena.leagues.${availability.type}`),
		icon: Clock3
	};
}

export function LeaguesContent({data}: {data: LeagueInfoRes}): ReactNode {
	const [selected, setSelected] = useState<number | undefined>();
	const {pending, message, open} = useCommandMenus();
	const leagues = [...data.leagues].sort((first, second) => first.minGloryPoints - second.minGloryPoints);
	const current = leagues.find(league => league.id === data.currentLeagueId);
	const next = current ? leagues.find(league => league.minGloryPoints > current.minGloryPoints) : undefined;
	const selectLeague = (id: number): void => setSelected(previous => previous === id ? undefined : id);
	const lock = claimLock(data.rewardAvailability);
	return <>
		<LeagueStanding data={data} {...next ? {next} : {}} />
		<ActionBanner
			icon={Trophy}
			label={i18n.t("app:arena.leagues.claim")}
			pending={pending}
			{...lock ? {lock} : {}}
			onPress={(): void => {
				open(REWARD_MENU).catch(console.error);
			}}
			testID="league-reward-unavailable"
		/>
		{message ? <Note>{message}</Note> : null}
		<SectionHeader>{i18n.t("app:arena.leagues.catalog")}</SectionHeader>
		<ExpandableList>{leagues.map(league => <LeagueChoice key={league.id} league={league} current={league.id === data.currentLeagueId} locked={league.minGloryPoints > data.glory} selected={league.id === selected} onSelect={selectLeague} />)}</ExpandableList>
	</>;
}

export function Leagues(): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.LEAGUES, () => GameClient.request(makeFromClientPacket(LeagueInfoReq, {}), LeagueInfoRes));
	return <GameQueryContent state={state} entity={GAME_ENTITIES.LEAGUES}>{packet => <LeaguesContent data={packet} />}</GameQueryContent>;
}
