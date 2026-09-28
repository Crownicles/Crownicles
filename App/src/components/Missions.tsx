import {ReactNode, useEffect, useState} from "react";
import {Text} from "react-native";
import {useQueryClient} from "@tanstack/react-query";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {MissionsReq} from "ws-packets/src/fromClient/MissionsReq";
import {MissionsRes} from "ws-packets/src/fromServer/missions/MissionsRes";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {Mission, MISSION_TYPES} from "ws-packets/src/objects/Mission";
import {GameAnswer, GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {RequestState, useGameQuery} from "@/src/store/useGameQuery";
import {useGameDeadline} from "@/src/store/useGameDeadline";
import {Button, ButtonRow, EmptyState, Note, SectionHeader} from "@/src/design/Primitives";
import {EntryRow, ExpandableList, useSectionStyles} from "@/src/design/Sections";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";
import {joinFacts} from "@/src/display/Facts";
import {missionDate, missionDescription} from "@/src/display/Missions";
import {UnclaimedMissions} from "@/src/components/MissionRewards";
import {useMissionRewards} from "@/src/store/MissionRewardsStore";

const CLOCK_INTERVAL = 60_000;
const MISSION_EMBLEM_SIZE = 26;

/** A mission still to do, with what kind it is and when it lapses. */
type MissionEntryData = {key: string; mission: Mission; kind: string; deadline?: string};

function MissionList({entries, now}: {entries: MissionEntryData[]; now: number}): ReactNode {
	const sectionStyles = useSectionStyles();
	return <ExpandableList>
		{entries.map(entry => <EntryRow
			key={entry.key}
			emblem={<TwemojiIcon emoji={AppIcons.getIcon(`missions.${entry.mission.missionType}`)} size={MISSION_EMBLEM_SIZE} />}
			title={missionDescription(entry.mission, now)}
			subtitle={joinFacts([entry.kind, entry.deadline])}
			end={<Text style={sectionStyles.amount}>{i18n.t("app:profile.formats.progress", {value: entry.mission.numberDone, max: entry.mission.missionObjective})}</Text>}
			testID={`mission-${entry.key}`}
		/>)}
	</ExpandableList>;
}

function missionOfType(data: MissionsRes, type: Mission["missionType"]): Mission | undefined {
	return data.missions.find(entry => entry.missionType === type);
}

function campaignEntry(data: MissionsRes): MissionEntryData[] {
	const mission = missionOfType(data, MISSION_TYPES.CAMPAIGN);
	if (data.campaignProgression === 0 || !mission) return [];
	return [{key: "campaign", mission, kind: i18n.t("app:missions.kinds.campaign", {value: data.campaignProgression, max: data.maxCampaignNumber})}];
}

function dailyEntry(data: MissionsRes): MissionEntryData[] {
	const mission = missionOfType(data, MISSION_TYPES.DAILY);
	if (data.dailyMission.completed || !mission) return [];
	return [{key: "daily", mission, kind: i18n.t("app:missions.kinds.daily"), deadline: i18n.t("app:missions.resetsAt", {date: missionDate(data.dailyMission.resetsAt)})}];
}

function sideEntries(data: MissionsRes): MissionEntryData[] {
	return data.missions.filter(entry => entry.missionType === MISSION_TYPES.NORMAL).map(mission => ({
		key: `${mission.missionId}:${mission.missionVariant}:${mission.expiresAt}`,
		mission,
		kind: i18n.t("app:missions.kinds.side"),
		...mission.expiresAt ? {deadline: i18n.t("app:missions.expiresAt", {date: missionDate(Date.parse(mission.expiresAt))})} : {}
	}));
}

/** Everything the player can still work on, whatever its kind: the one place to look for what to do. */
function MissionsToDo({data, now, first}: {data: MissionsRes; now: number; first: boolean}): ReactNode {
	const entries = [...campaignEntry(data), ...dailyEntry(data), ...sideEntries(data)];
	return <>
		<SectionHeader first={first}>{i18n.t("app:missions.todo")}</SectionHeader>
		{entries.length === 0
			? <Note>{i18n.t("app:missions.nothingToDo")}</Note>
			: <MissionList entries={entries} now={now} />}
	</>;
}

function DoneRow({title, subtitle, testID}: {title: string; subtitle?: string; testID: string}): ReactNode {
	return <EntryRow
		emblem={<TwemojiIcon emoji={AppIcons.getIcon("messages.validate")} size={MISSION_EMBLEM_SIZE} />}
		title={title}
		{...subtitle ? {subtitle} : {}}
		disabled
		testID={testID}
	/>;
}

/** What is over and asks nothing more, set apart below so it never reads as something to do. */
function MissionsDone({data, now}: {data: MissionsRes; now: number}): ReactNode {
	const daily = missionOfType(data, MISSION_TYPES.DAILY);
	const dailyDone = data.dailyMission.completed && daily !== undefined;
	const campaignDone = data.campaignProgression === 0;
	if (!dailyDone && !campaignDone) return null;
	return <>
		<SectionHeader>{i18n.t("app:missions.done")}</SectionHeader>
		<ExpandableList>
			{dailyDone ? <DoneRow
				title={missionDescription(daily, now)}
				subtitle={i18n.t("app:missions.dailyDone", {date: missionDate(data.dailyMission.resetsAt)})}
				testID="mission-daily-done"
			/> : null}
			{campaignDone ? <DoneRow title={i18n.t("app:missions.campaignCompleted")} testID="mission-campaign-done" /> : null}
		</ExpandableList>
	</>;
}

export function MissionsContent({data, now}: {data: MissionsRes; now: number}): ReactNode {
	const rewardsFirst = useMissionRewards().rewards.missions.length > 0;
	if (data.missions.length === 0) return <EmptyState>{i18n.t("app:missions.empty")}</EmptyState>;
	return <>
		<MissionsToDo data={data} first={!rewardsFirst} now={now} />
		<MissionsDone data={data} now={now} />
	</>;
}

function requestMissions(passive: boolean): Promise<GameAnswer<MissionsRes>> {
	return GameClient.request(makeFromClientPacket(MissionsReq, {askedPlayer: {}, ...passive ? {passive} : {}}), MissionsRes, [PlayerNotFound]);
}

/** The player's missions, read through the shared cache; an answer also refreshes the profile Core rewarded. */
export function useMissions(): RequestState<MissionsRes> {
	const queryClient = useQueryClient();
	return useGameQuery(GAME_ENTITIES.MISSIONS, async () => {
		// Screens glance at the missions on their own: only opening them counts as consulting them.
		const answer = await requestMissions(true);
		if (answer.kind === "answer") await queryClient.invalidateQueries({queryKey: gameKey(GAME_ENTITIES.PROFILE)});
		return answer;
	});
}

/** Opening the missions is what the campaign counts as the player consulting them. */
function useConsultMissions(): void {
	const queryClient = useQueryClient();
	useEffect(() => {
		requestMissions(false)
			.then(async answer => {
				if (answer.kind === "timeout") return;
				queryClient.setQueryData(gameKey(GAME_ENTITIES.MISSIONS), answer);
				if (answer.kind === "answer") await queryClient.invalidateQueries({queryKey: gameKey(GAME_ENTITIES.PROFILE)});
			})
			.catch(error => console.error("Failed to consult the missions:", error));
	}, [queryClient]);
}

export function Missions(): ReactNode {
	const queryClient = useQueryClient();
	const [now, setNow] = useState(Date.now);
	const state = useMissions();
	useConsultMissions();
	const resetsAt = state.status === "ready" ? state.data.dailyMission.resetsAt : null;
	useGameDeadline(GAME_ENTITIES.MISSIONS, resetsAt);
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), CLOCK_INTERVAL);
		return (): void => clearInterval(timer);
	}, []);
	if (state.status === "loading") return <EmptyState>{i18n.t("app:common.loading")}</EmptyState>;
	if (state.status === "failed") return <>
		<EmptyState>{i18n.t("app:common.error")}</EmptyState>
		<ButtonRow><Button onPress={(): void => { queryClient.invalidateQueries({queryKey: gameKey(GAME_ENTITIES.MISSIONS)}).catch(console.error); }}>{i18n.t("app:common.retry")}</Button></ButtonRow>
	</>;
	if (state.status === "empty") return <EmptyState>{i18n.t("app:profile.notFound")}</EmptyState>;
	return <>
		<UnclaimedMissions />
		<MissionsContent data={state.data} now={now} />
	</>;
}