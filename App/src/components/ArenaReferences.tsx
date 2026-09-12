import {ReactNode, useState} from "react";
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
import {className} from "@/src/display/Classes";
import {formatMoney, formatNumber} from "@/src/display/Amounts";
import {missionDate} from "@/src/display/Missions";
import {i18n} from "@/src/translations/i18n";

const RESULT_LABELS = {[EloGameResult.WIN]: "app:arena.victory", [EloGameResult.LOSS]: "app:arena.defeat", [EloGameResult.DRAW]: "app:arena.draw"} as const;
const REWARD_MENU: CommandMenu = {request: LeagueRewardReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [LeagueRewardRes]};

function HistoryEntry({entry}: {entry: FightHistoryEntry}): ReactNode {
	const [expanded, setExpanded] = useState(false);
	return <Panel>
		<Row title={i18n.t(entry.initiator ? "app:arena.history.attacked" : "app:arena.history.defended", {opponent: entry.opponentName ?? i18n.t("app:arena.opponent")})}
			subtitle={missionDate(entry.date)} end={i18n.t(RESULT_LABELS[entry.result])} onPress={(): void => setExpanded(!expanded)} chevron />
		<KeyValue label={i18n.t("app:arena.glory")} value={i18n.t("app:arena.gloryChange", {before: entry.glory.initial.me, after: entry.glory.initial.me + entry.glory.change.me})} />
		{entry.glory.leaguesChanges.me ? <KeyValue label={i18n.t("app:arena.league")} value={i18n.t(`models:leagues.${entry.glory.leaguesChanges.me.newLeague}`)} /> : null}
		{expanded ? <>
			<KeyValue label={i18n.t("app:arena.class")} value={className(entry.classes.me)} />
			<KeyValue label={i18n.t("app:arena.history.opponentClass")} value={className(entry.classes.opponent)} />
			<KeyValue label={i18n.t("app:arena.history.opponentGlory")} value={i18n.t("app:arena.gloryChange", {before: entry.glory.initial.opponent, after: entry.glory.initial.opponent + entry.glory.change.opponent})} />
		</> : null}
	</Panel>;
}

export function FightHistoryContent({history}: {history: FightHistoryEntry[]}): ReactNode {
	return history.length ? <>{history.map(entry => <HistoryEntry key={entry.id} entry={entry} />)}</> : <Note>{i18n.t("app:arena.history.empty")}</Note>;
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
