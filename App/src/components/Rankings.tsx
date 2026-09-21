import {ReactNode, useState} from "react";
import {Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle} from "react-native";
import {TopDataType, TopTiming, RankingEntry} from "ws-packets/src/objects/Rankings";
import {TopRes} from "ws-packets/src/fromServer/fight/RankingsRes";
import {RankingSelection, useRankings} from "@/src/store/useRankings";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {UnitIcon} from "@/src/components/UnitIcon";
import {EmptyState, Note, Panel, SectionHeader} from "@/src/design/Primitives";
import {Standing} from "@/src/design/Sections";
import {SegmentedControl} from "@/src/design/SegmentedControl";
import {ChevronDown} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {AppIcons} from "@/src/AppIcons";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

/** Each board counts its own currency, and shows the emoji the rest of the game gives it. */
const RANKING_UNITS: Record<TopDataType, string> = {
	[TopDataType.SCORE]: "score",
	[TopDataType.GLORY]: "glory",
	[TopDataType.GUILD]: "guildPoint"
};
const PODIUM_LAST_RANK = 3;

const styles = StyleSheet.create({
	entry: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.md, minHeight: 64, paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.md, borderLeftWidth: 3, borderLeftColor: "transparent"},
	entrySelf: {backgroundColor: Theme.colors.wash, borderLeftColor: Theme.colors.green},
	rankBadge: {minWidth: 38, height: 30, flexShrink: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: Theme.spacing.sm, backgroundColor: Theme.colors.wash, borderRadius: 10},
	rankBadgePodium: {backgroundColor: Theme.colors.paper, borderWidth: 1, borderColor: Theme.colors.gold},
	rank: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.rowSubtitle, color: Theme.colors.muted, fontVariant: ["tabular-nums"]},
	rankPodium: {color: Theme.colors.gold},
	body: {flex: 1, minWidth: 0, gap: 3},
	name: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowTitle, color: Theme.colors.ink},
	meta: {flexDirection: "row", alignItems: "center", gap: 5},
	metaText: {flex: 1, fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.rowSubtitle, lineHeight: Theme.lineHeight.rowSubtitle, color: Theme.colors.muted},
	end: {alignItems: "flex-end", maxWidth: "40%", gap: 3, flexShrink: 1},
	value: {flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1},
	valueText: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.rowTitle, color: Theme.colors.ink, fontVariant: ["tabular-nums"], flexShrink: 1},
	self: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.caption, color: Theme.colors.green},
	pagination: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.md, paddingBottom: Theme.spacing.md},
	pageLabel: {flex: 1, minHeight: 40, justifyContent: "center"},
	page: {textAlign: "center", fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.caption, color: Theme.colors.muted},
	pageAction: {color: Theme.colors.blue},
	pageButton: {width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: Theme.colors.wash, borderRadius: Theme.pillRadius},
	pageButtonDisabled: {opacity: 0.35},
	pressed: {opacity: 0.7},
	previousArrow: {transform: [{rotate: "90deg"}]},
	nextArrow: {transform: [{rotate: "-90deg"}]}
});

/** The badges a ranked player carries: their league, where they travel, what ails them. */
function entryIcons(entry: RankingEntry): string[] {
	const paths: string[] = [];
	if (entry.leagueId !== undefined) paths.push(`leagues.${entry.leagueId}`);
	if (entry.mapType) paths.push(`mapTypes.${entry.mapType}`);
	if (entry.effectId) paths.push(`effects.${entry.effectId}`);
	return paths.map(path => AppIcons.getIconOrNull(path)).filter(icon => icon !== null);
}

function entryMeta(entry: RankingEntry): string {
	const labels = [i18n.t("app:guild.level", {level: entry.level})];
	if (entry.leagueId !== undefined) labels.push(i18n.t(`models:leagues.${entry.leagueId}`));
	if (entry.afk) labels.push(i18n.t("app:arena.rankings.inactive"));
	return labels.join(" · ");
}

/** The page the player sits on, so the list can jump straight to it instead of being paged through. */
function playerPage(data: TopRes): number | undefined {
	return data.contextRank ? Math.ceil(data.contextRank / data.elementsPerPage) : undefined;
}

function RankingStanding({data, onPage}: {data: TopRes; onPage: (page: number) => void}): ReactNode {
	const target = playerPage(data);
	const reachable = target !== undefined && target !== data.pageNumber;
	return <Standing
		testID="ranking-standing"
		emblem={<UnitIcon unit={RANKING_UNITS[data.dataType]} size={30} />}
		caption={i18n.t("app:arena.rankings.yourPlace")}
		title={data.contextRank ? formatNumber(data.contextRank) : i18n.t("app:profile.values.unranked")}
		subtitle={i18n.t("app:arena.rankings.ofTotal", {total: formatNumber(data.totalElements)})}
		{...reachable ? {onPress: (): void => onPage(target), accessibilityLabel: i18n.t("app:arena.rankings.goToMyPage")} : {}}
	/>;
}

function RankingRow({entry, unit}: {entry: RankingEntry; unit: string}): ReactNode {
	const podium = entry.rank <= PODIUM_LAST_RANK;
	return <View style={[styles.entry, entry.sameContext && styles.entrySelf]}>
		<View style={[styles.rankBadge, podium && styles.rankBadgePodium]}>
			<Text style={[styles.rank, podium && styles.rankPodium]} numberOfLines={1}>{formatNumber(entry.rank)}</Text>
		</View>
		<View style={styles.body}>
			<Text style={styles.name} numberOfLines={1}>{entry.name || i18n.t("app:arena.unknownPlayer")}</Text>
			<View style={styles.meta}>
				{entryIcons(entry).map(icon => <TwemojiIcon key={icon} emoji={icon} size={12} />)}
				<Text style={styles.metaText} numberOfLines={1}>{entryMeta(entry)}</Text>
			</View>
		</View>
		<View style={styles.end}>
			<View style={styles.value}>
				<Text style={styles.valueText} numberOfLines={1}>{formatNumber(entry.value)}</Text>
				<UnitIcon unit={unit} size={12} />
			</View>
			{entry.sameContext ? <Text style={styles.self}>{i18n.t("app:arena.you")}</Text> : null}
		</View>
	</View>;
}

function PageArrow({label, arrow, disabled, onPress}: {label: string; arrow: StyleProp<ViewStyle>; disabled: boolean; onPress: () => void}): ReactNode {
	return <Pressable
		accessibilityRole="button"
		accessibilityLabel={label}
		accessibilityState={{disabled}}
		disabled={disabled}
		onPress={onPress}
		style={({pressed}) => [styles.pageButton, disabled && styles.pageButtonDisabled, pressed && styles.pressed]}
	><View style={arrow}><ChevronDown size={18} color={Theme.colors.ink} /></View></Pressable>;
}

function RankingPagination({page, lastPage, onPage}: {page: number; lastPage: number; onPage: (page: number) => void}): ReactNode {
	const atStart = page <= 1;
	return <View style={styles.pagination}>
		<PageArrow label={i18n.t("app:arena.rankings.previous")} arrow={styles.previousArrow} disabled={atStart} onPress={(): void => onPage(page - 1)} />
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={i18n.t("app:arena.rankings.backToFirst")}
			accessibilityState={{disabled: atStart}}
			disabled={atStart}
			onPress={(): void => onPage(1)}
			style={styles.pageLabel}
		><Text style={[styles.page, !atStart && styles.pageAction]}>{i18n.t(atStart ? "app:arena.rankings.page" : "app:arena.rankings.pageWithReset", {page, total: lastPage})}</Text></Pressable>
		<PageArrow label={i18n.t("app:arena.rankings.next")} arrow={styles.nextArrow} disabled={page >= lastPage} onPress={(): void => onPage(page + 1)} />
	</View>;
}

export function RankingsContent({data, onPage}: {data: TopRes; onPage: (page: number) => void}): ReactNode {
	const lastPage = Math.max(1, Math.ceil(data.totalElements / data.elementsPerPage));
	const unit = RANKING_UNITS[data.dataType];
	return <>
		<RankingStanding data={data} onPage={onPage} />
		{data.needFight ? <Note>{i18n.t("app:arena.rankings.needFight", {count: data.needFight})}</Note> : null}
		{!data.contextRank && !data.canBeRanked ? <Note>{i18n.t("app:arena.rankings.unavailable")}</Note> : null}
		<SectionHeader first>{i18n.t("app:arena.rankings.positions")}</SectionHeader>
		{lastPage > 1 ? <RankingPagination page={data.pageNumber} lastPage={lastPage} onPage={onPage} /> : null}
		{data.elements.length
			? <Panel>{data.elements.map(entry => <RankingRow key={entry.rank} entry={entry} unit={unit} />)}</Panel>
			: <Panel><EmptyState>{i18n.t("app:arena.rankings.empty")}</EmptyState></Panel>}
	</>;
}

export function Rankings(): ReactNode {
	const [selection, setSelection] = useState<RankingSelection>({dataType: TopDataType.SCORE, timing: TopTiming.ALL_TIME});
	const state = useRankings(selection);
	const selectType = (dataType: TopDataType): void => setSelection({dataType, timing: dataType === TopDataType.GLORY ? TopTiming.WEEK : TopTiming.ALL_TIME});
	return <>
		<SegmentedControl label={i18n.t("app:arena.rankings.title")} value={selection.dataType} onChange={selectType} options={Object.values(TopDataType).map(value => ({value, label: i18n.t(`app:arena.rankings.types.${value}`)}))} />
		{selection.dataType === TopDataType.SCORE ? <SegmentedControl label={i18n.t("app:arena.rankings.period")} value={selection.timing} onChange={(timing): void => setSelection({dataType: selection.dataType, timing})} options={Object.values(TopTiming).map(value => ({value, label: i18n.t(`app:arena.rankings.timings.${value}`)}))} /> : null}
		<GameQueryContent state={state} entity={GAME_ENTITIES.RANKINGS}>{packet => <RankingsContent data={packet} onPage={(page): void => setSelection({...selection, page})} />}</GameQueryContent>
	</>;
}
