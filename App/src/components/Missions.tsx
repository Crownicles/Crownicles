import {ReactNode, useEffect, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {MissionsReq} from "ws-packets/src/fromClient/MissionsReq";
import {MissionsRes} from "ws-packets/src/fromServer/missions/MissionsRes";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {Mission, MISSION_TYPES} from "ws-packets/src/objects/Mission";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {Button, ButtonRow, EmptyState, Note, Panel, Row, SectionHeader, StatBar} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";
import {missionDate, missionDescription} from "@/src/display/Missions";

const CLOCK_INTERVAL = 60_000;

function MissionProgress({mission, now, completed = false}: {mission: Mission; now: number; completed?: boolean}): ReactNode {
	return <Panel>
		<Row title={missionDescription(mission, now)} end={i18n.t(completed ? "app:missions.completed" : "app:missions.inProgress")} />
		<StatBar label={i18n.t("app:missions.progress")} value={i18n.t("app:profile.formats.progress", {value: mission.numberDone, max: mission.missionObjective})} ratio={mission.missionObjective > 0 ? mission.numberDone / mission.missionObjective : 0} color={Theme.colors.gold} />
	</Panel>;
}

function CampaignMissions({data, now}: {data: MissionsRes; now: number}): ReactNode {
	const mission = data.missions.find(entry => entry.missionType === MISSION_TYPES.CAMPAIGN);
	return <>
		<SectionHeader first action={{hint: i18n.t("app:profile.formats.progress", {value: data.campaignProgression || data.maxCampaignNumber, max: data.maxCampaignNumber})}}>{i18n.t("app:missions.campaign")}</SectionHeader>
		{data.campaignProgression === 0 ? <Note>{i18n.t("app:missions.campaignCompleted")}</Note> : mission ? <MissionProgress mission={mission} now={now} /> : <Note>{i18n.t("app:missions.empty")}</Note>}
	</>;
}

function DailyMission({data, now}: {data: MissionsRes; now: number}): ReactNode {
	const mission = data.missions.find(entry => entry.missionType === MISSION_TYPES.DAILY);
	return <>
		<SectionHeader>{i18n.t("app:missions.daily")}</SectionHeader>
		{mission ? <MissionProgress mission={mission} now={now} completed={data.dailyMission.completed} /> : <Note>{i18n.t("app:missions.empty")}</Note>}
		<Note>{i18n.t("app:missions.resetsAt", {date: missionDate(data.dailyMission.resetsAt)})}</Note>
	</>;
}

function MissionEntry({mission, now}: {mission: Mission; now: number}): ReactNode {
	return <>
		<MissionProgress mission={mission} now={now} />
		{mission.expiresAt ? <Note>{i18n.t("app:missions.expiresAt", {date: missionDate(Date.parse(mission.expiresAt))})}</Note> : null}
	</>;
}

function SideMissions({data, now}: {data: MissionsRes; now: number}): ReactNode {
	const missions = data.missions.filter(entry => entry.missionType === MISSION_TYPES.NORMAL);
	return <>
		<SectionHeader action={{hint: i18n.t("app:profile.formats.progress", {value: missions.length, max: data.maxSideMissionSlots})}}>{i18n.t("app:missions.side")}</SectionHeader>
		{missions.length === 0 ? <Note>{i18n.t("app:missions.noSideMissions")}</Note> : missions.map(mission => <MissionEntry key={`${mission.missionId}:${mission.missionVariant}:${mission.expiresAt}`} mission={mission} now={now} />)}
	</>;
}

export function MissionsContent({data, now}: {data: MissionsRes; now: number}): ReactNode {
	if (data.missions.length === 0) return <EmptyState>{i18n.t("app:missions.empty")}</EmptyState>;
	return <><CampaignMissions data={data} now={now} /><DailyMission data={data} now={now} /><SideMissions data={data} now={now} /></>;
}

export function Missions(): ReactNode {
	const queryClient = useQueryClient();
	const [now, setNow] = useState(Date.now);
	const state = useGameQuery(GAME_ENTITIES.MISSIONS, async () => {
		const answer = await GameClient.request(makeFromClientPacket(MissionsReq, {askedPlayer: {}}), MissionsRes, [PlayerNotFound]);
		if (answer.kind === "answer") await queryClient.invalidateQueries({queryKey: gameKey(GAME_ENTITIES.PROFILE)});
		return answer;
	});
	const resetsAt = state.status === "ready" ? state.data.dailyMission.resetsAt : null;
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), CLOCK_INTERVAL);
		return (): void => clearInterval(timer);
	}, []);
	useEffect(() => {
		if (!resetsAt || resetsAt <= Date.now()) return;
		const timer = setTimeout(() => {
			queryClient.invalidateQueries({queryKey: gameKey(GAME_ENTITIES.MISSIONS)}).catch(console.error);
		}, resetsAt - Date.now());
		return (): void => clearTimeout(timer);
	}, [resetsAt, queryClient]);
	if (state.status === "loading") return <EmptyState>{i18n.t("app:common.loading")}</EmptyState>;
	if (state.status === "failed") return <>
		<EmptyState>{i18n.t("app:common.error")}</EmptyState>
		<ButtonRow><Button onPress={(): void => { queryClient.invalidateQueries({queryKey: gameKey(GAME_ENTITIES.MISSIONS)}).catch(console.error); }}>{i18n.t("app:common.retry")}</Button></ButtonRow>
	</>;
	if (state.status === "empty") return <EmptyState>{i18n.t("app:profile.notFound")}</EmptyState>;
	return <MissionsContent data={state.data} now={now} />;
}