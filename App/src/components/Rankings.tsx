import {ReactNode, useState} from "react";
import {TopDataType, TopTiming, RankingEntry} from "ws-packets/src/objects/Rankings";
import {TopRes} from "ws-packets/src/fromServer/fight/RankingsRes";
import {RankingSelection, useRankings} from "@/src/store/useRankings";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {Button, ButtonRow, Note, Panel, Row, SectionHeader} from "@/src/design/Primitives";
import {SegmentedControl} from "@/src/design/SegmentedControl";
import {AppIcons} from "@/src/AppIcons";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

function rankingSubtitle(entry: RankingEntry): string {
	const labels = [i18n.t("app:guild.level", {level: entry.level})];
	if (entry.leagueId !== undefined) labels.push(i18n.t(`models:leagues.${entry.leagueId}`));
	if (entry.afk) labels.push(i18n.t("app:arena.rankings.inactive"));
	if (entry.mapType) labels.push(AppIcons.getIcon(`mapTypes.${entry.mapType}`));
	if (entry.effectId) labels.push(AppIcons.getIcon(`effects.${entry.effectId}`));
	return labels.join(" · ");
}

export function RankingsContent({data, onPage}: {data: TopRes; onPage: (page: number) => void}): ReactNode {
	const lastPage = Math.max(1, Math.ceil(data.totalElements / data.elementsPerPage));
	return <>
		<SectionHeader action={{hint: formatNumber(data.totalElements)}}>{i18n.t("app:arena.rankings.positions")}</SectionHeader>
		{data.contextRank ? <Note>{i18n.t("app:arena.rankings.yourRank", {rank: data.contextRank})}</Note> : <Note>{i18n.t(data.canBeRanked ? "app:profile.values.unranked" : "app:arena.rankings.unavailable")}</Note>}
		{data.needFight && data.needFight > 0 ? <Note>{i18n.t("app:arena.rankings.needFight", {count: data.needFight})}</Note> : null}
		<Panel>{data.elements.map(entry => <Row key={entry.rank} title={i18n.t("app:arena.rankings.entry", {rank: entry.rank, name: entry.name || i18n.t("app:arena.unknownPlayer")})}
			subtitle={rankingSubtitle(entry)} end={i18n.t(entry.sameContext ? "app:arena.rankings.selfValue" : "app:arena.rankings.value", {value: formatNumber(entry.value)})} />)}</Panel>
		<Note>{i18n.t("app:arena.rankings.page", {page: data.pageNumber, total: lastPage})}</Note>
		<ButtonRow>
			<Button disabled={data.pageNumber <= 1} onPress={(): void => onPage(data.pageNumber - 1)}>{i18n.t("app:arena.rankings.previous")}</Button>
			<Button disabled={data.pageNumber >= lastPage} onPress={(): void => onPage(data.pageNumber + 1)}>{i18n.t("app:arena.rankings.next")}</Button>
		</ButtonRow>
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
