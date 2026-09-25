import {ReactNode, useEffect, useState} from "react";
import {Text} from "react-native";
import {useQueryClient} from "@tanstack/react-query";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {MissionsReq} from "ws-packets/src/fromClient/MissionsReq";
import {MissionsRes} from "ws-packets/src/fromServer/missions/MissionsRes";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {Mission, MISSION_TYPES} from "ws-packets/src/objects/Mission";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {RequestState, useGameQuery} from "@/src/store/useGameQuery";
import {useGameDeadline} from "@/src/store/useGameDeadline";
import {FightGauge} from "@/src/components/FightGauge";
import {Button, ButtonRow, EmptyState, Note, SectionHeader} from "@/src/design/Primitives";
import {ExpandableEntry, ExpandableList, sectionStyles} from "@/src/design/Sections";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {ExpandedEntry, useExpandedEntry} from "@/src/design/useExpandedEntry";
import {AppIcons} from "@/src/AppIcons";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";
import {missionDate, missionDescription} from "@/src/display/Missions";
import {UnclaimedMissions} from "@/src/components/MissionRewards";
import {useMissionRewards} from "@/src/store/MissionRewardsStore";

const CLOCK_INTERVAL = 60_000;
const MISSION_EMBLEM_SIZE = 26;

/** A mission and the two things only it knows: whether the server calls it done, and when it lapses. */
type MissionEntryData = {key: string; mission: Mission; completed: boolean; deadline?: string};
type MissionListProps = {entries: MissionEntryData[]; now: number; unfolding: ExpandedEntry<string>};

function MissionList({entries, now, unfolding}: MissionListProps): ReactNode {
	return <ExpandableList>
		{entries.map(entry => <ExpandableEntry
			key={entry.key}
			emblem={<TwemojiIcon emoji={AppIcons.getIcon(`missions.${entry.mission.missionType}`)} size={MISSION_EMBLEM_SIZE} />}
			label={missionDescription(entry.mission, now)}
			caption={i18n.t(entry.completed ? "app:missions.completed" : "app:missions.inProgress")}
			end={<Text style={sectionStyles.amount}>{i18n.t("app:profile.formats.progress", {value: entry.mission.numberDone, max: entry.mission.missionObjective})}</Text>}
			expanded={unfolding.isExpanded(entry.key)}
			onToggle={(): void => unfolding.toggle(entry.key)}
			testID={`mission-${entry.key}`}
		>
			<FightGauge
				label={i18n.t("app:missions.progress")}
				value={entry.mission.numberDone}
				max={entry.mission.missionObjective}
				color={Theme.colors.gold}
			/>
			{entry.deadline ? <Text style={sectionStyles.caption}>{entry.deadline}</Text> : null}
		</ExpandableEntry>)}
	</ExpandableList>;
}

function CampaignMissions({data, now, unfolding, first}: {data: MissionsRes; first: boolean} & Omit<MissionListProps, "entries">): ReactNode {
	const mission = data.missions.find(entry => entry.missionType === MISSION_TYPES.CAMPAIGN);
	return <>
		<SectionHeader first={first} action={{hint: i18n.t("app:profile.formats.progress", {value: data.campaignProgression || data.maxCampaignNumber, max: data.maxCampaignNumber})}}>{i18n.t("app:missions.campaign")}</SectionHeader>
		{data.campaignProgression === 0
			? <Note>{i18n.t("app:missions.campaignCompleted")}</Note>
			: mission
				? <MissionList entries={[{key: "campaign", mission, completed: false}]} now={now} unfolding={unfolding} />
				: <Note>{i18n.t("app:missions.empty")}</Note>}
	</>;
}

function DailyMission({data, now, unfolding}: {data: MissionsRes} & Omit<MissionListProps, "entries">): ReactNode {
	const mission = data.missions.find(entry => entry.missionType === MISSION_TYPES.DAILY);
	return <>
		<SectionHeader>{i18n.t("app:missions.daily")}</SectionHeader>
		{mission
			? <MissionList
				entries={[{key: "daily", mission, completed: data.dailyMission.completed, deadline: i18n.t("app:missions.resetsAt", {date: missionDate(data.dailyMission.resetsAt)})}]}
				now={now}
				unfolding={unfolding}
			/>
			: <Note>{i18n.t("app:missions.empty")}</Note>}
	</>;
}

function SideMissions({data, now, unfolding}: {data: MissionsRes} & Omit<MissionListProps, "entries">): ReactNode {
	const missions = data.missions.filter(entry => entry.missionType === MISSION_TYPES.NORMAL);
	return <>
		<SectionHeader action={{hint: i18n.t("app:profile.formats.progress", {value: missions.length, max: data.maxSideMissionSlots})}}>{i18n.t("app:missions.side")}</SectionHeader>
		{missions.length === 0
			? <Note>{i18n.t("app:missions.noSideMissions")}</Note>
			: <MissionList
				entries={missions.map(mission => ({
					key: `${mission.missionId}:${mission.missionVariant}:${mission.expiresAt}`,
					mission,
					completed: false,
					...mission.expiresAt ? {deadline: i18n.t("app:missions.expiresAt", {date: missionDate(Date.parse(mission.expiresAt))})} : {}
				}))}
				now={now}
				unfolding={unfolding}
			/>}
	</>;
}

export function MissionsContent({data, now}: {data: MissionsRes; now: number}): ReactNode {
	const unfolding = useExpandedEntry<string>();
	const rewardsFirst = useMissionRewards().rewards.missions.length > 0;
	if (data.missions.length === 0) return <EmptyState>{i18n.t("app:missions.empty")}</EmptyState>;
	const sections = {now, unfolding};
	return <>
		<CampaignMissions data={data} first={!rewardsFirst} {...sections} />
		<DailyMission data={data} {...sections} />
		<SideMissions data={data} {...sections} />
	</>;
}

/** The player's missions, read through the shared cache; an answer also refreshes the profile Core rewarded. */
export function useMissions(): RequestState<MissionsRes> {
	const queryClient = useQueryClient();
	return useGameQuery(GAME_ENTITIES.MISSIONS, async () => {
		const answer = await GameClient.request(makeFromClientPacket(MissionsReq, {askedPlayer: {}}), MissionsRes, [PlayerNotFound]);
		if (answer.kind === "answer") await queryClient.invalidateQueries({queryKey: gameKey(GAME_ENTITIES.PROFILE)});
		return answer;
	});
}

export function Missions(): ReactNode {
	const queryClient = useQueryClient();
	const [now, setNow] = useState(Date.now);
	const state = useMissions();
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