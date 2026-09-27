import {ReactNode, useEffect, useState} from "react";
import {StyleSheet, Text, View} from "react-native";
import {useRouter} from "expo-router";
import {Mission} from "ws-packets/src/objects/Mission";
import {ONBOARDING_TRIALS} from "ws-packets/src/objects/Onboarding";
import {AppIcons} from "@/src/AppIcons";
import {Note, SectionHeader} from "@/src/design/Primitives";
import {Card, EntryRow, ExpandableList, Fact} from "@/src/design/Sections";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Missions, useMissions} from "@/src/components/Missions";
import {missionDescription} from "@/src/display/Missions";
import {Contest, contestOf, ContestSeal, ContestTrial, isContestBookletAvailable, isContestRunning, SEAL_STATES} from "@/src/onboarding/Contest";
import {GuideTip} from "@/src/onboarding/GuideTip";
import {ONBOARDING_MOMENTS, useOnboardingMoments} from "@/src/onboarding/OnboardingStore";
import {i18n} from "@/src/translations/i18n";

const SEAL_SIZE = 22;
const MISSION_EMBLEM = 26;

const styles = StyleSheet.create({
	strip: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.md, paddingHorizontal: Theme.spacing.md, paddingTop: Theme.spacing.md},
	trialSeals: {flexDirection: "row", gap: Theme.spacing.xs},
	seal: {width: SEAL_SIZE, height: SEAL_SIZE, borderRadius: SEAL_SIZE / 2, alignItems: "center", justifyContent: "center"},
	current: {borderWidth: 2, borderColor: Theme.colors.gold, backgroundColor: Theme.colors.goldWash},
	ahead: {borderWidth: 1, borderColor: Theme.colors.line, backgroundColor: Theme.colors.wash},
	trialTitle: {flex: 1, fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.caption, color: Theme.colors.muted, textAlign: "right"}
});

export type ContestView = {contest: Contest; running: boolean; bookletAvailable: boolean};

/** The contest as the player's missions draw it, read without counting as opening the booklet. */
export function useContest(): ContestView | null {
	const missions = useMissions();
	const {mark} = useOnboardingMoments();
	const view = missions.status === "ready" ? {
		contest: contestOf(missions.data),
		running: isContestRunning(missions.data.campaignProgression),
		bookletAvailable: isContestBookletAvailable(missions.data.campaignProgression)
	} : null;
	const running = view?.running ?? false;
	useEffect(() => {
		if (running) mark(ONBOARDING_MOMENTS.CONTEST_JOINED);
	}, [running, mark]);
	return view;
}

function Seal({seal}: {seal: ContestSeal}): ReactNode {
	if (seal.state === SEAL_STATES.SEALED) {
		return <View style={styles.seal} testID="contest-seal-sealed"><TwemojiIcon emoji={AppIcons.getIcon("other.seal")} size={SEAL_SIZE} /></View>;
	}
	return <View style={[styles.seal, seal.state === SEAL_STATES.CURRENT ? styles.current : styles.ahead]} testID={`contest-seal-${seal.state}`} />;
}

/** Every seal of the contest, grouped by trial, so the player sees how far the booklet is filled. */
function SealStrip({contest, trial}: {contest: Contest; trial: ContestTrial}): ReactNode {
	return <View style={styles.strip}>
		{contest.trials.map(candidate => <View key={candidate.id} style={styles.trialSeals}>
			{candidate.seals.map(seal => <Seal key={seal.missionId} seal={seal} />)}
		</View>)}
		<Text style={styles.trialTitle} numberOfLines={1}>{i18n.t(`app:contest.trials.${trial.id}.title`)}</Text>
	</View>;
}

/** Where the current mission is done, so the booklet leads there instead of only naming it. */
type ContestTarget = "booklet" | "map" | "inventory" | "classes";

const MISSION_TARGETS: Partial<Record<string, ContestTarget>> = {
	findOrBuyItem: "inventory",
	drinkPotion: "inventory",
	commandMap: "map",
	chooseClass: "classes"
};

export type ContestOpeners = {openBooklet: () => void; openMap: () => void};

const TARGET_LABELS: Record<ContestTarget, string> = {
	booklet: "app:contest.actions.open",
	map: "app:contest.actions.openMap",
	inventory: "app:contest.actions.openInventory",
	classes: "app:contest.actions.chooseClass"
};

function useContestTarget({openBooklet, openMap}: ContestOpeners): (mission: Mission) => {label: string; onPress: () => void} {
	const router = useRouter();
	const go: Record<ContestTarget, () => void> = {
		booklet: openBooklet,
		map: openMap,
		inventory: (): void => router.push("/profile/inventory"),
		classes: (): void => router.push("/arena/classes")
	};
	return mission => {
		const target = MISSION_TARGETS[mission.missionId] ?? "booklet";
		return {label: i18n.t(TARGET_LABELS[target]), onPress: go[target]};
	};
}

/**
 * Stands on the adventure while the royal contest runs: the seals already set, the one mission to do
 * now, and the guide's word on how to do it. Only the current step is named, never what follows.
 */
export function ContestBookletCard(openers: ContestOpeners): ReactNode {
	const view = useContest();
	const target = useContestTarget(openers);
	const current = view?.running ? view.contest.current : null;
	if (!view || !current) return null;
	const {trial, mission} = current;
	const action = target(mission);
	return <>
		<SectionHeader action={{hint: i18n.t("app:contest.trial", {number: trial.number, count: ONBOARDING_TRIALS.length})}}>{i18n.t("app:contest.title")}</SectionHeader>
		<Card>
			<SealStrip contest={view.contest} trial={trial} />
			<EntryRow
				emblem={<TwemojiIcon emoji={AppIcons.getIcon("other.guide")} size={MISSION_EMBLEM} />}
				title={i18n.t(`app:contest.missions.${mission.missionId}`)}
				subtitle={i18n.t(`app:contest.hints.${mission.missionId}`)}
				end={action.label}
				onPress={action.onPress}
				testID="contest-current-mission"
			/>
		</Card>
	</>;
}

function sealLabel(seal: ContestSeal): string {
	if (seal.state === SEAL_STATES.SEALED) return i18n.t("app:contest.sealed");
	return i18n.t(seal.state === SEAL_STATES.CURRENT ? "app:contest.current" : "app:contest.soon");
}

function TrialSection({trial, current, now}: {trial: ContestTrial; current: Mission | null; now: number}): ReactNode {
	return <>
		<SectionHeader icon={AppIcons.getIcon(trial.state === SEAL_STATES.SEALED ? "other.seal" : "other.contestBooklet")}>
			{`${i18n.t("app:contest.trial", {number: trial.number, count: ONBOARDING_TRIALS.length})} · ${i18n.t(`app:contest.trials.${trial.id}.title`)}`}
		</SectionHeader>
		<Note>{i18n.t(`app:contest.trials.${trial.id}.description`)}</Note>
		<ExpandableList>
			{trial.seals.map(seal => <Fact
				key={seal.missionId}
				label={seal.state === SEAL_STATES.AHEAD
					? i18n.t("app:contest.ahead")
					: seal.state === SEAL_STATES.CURRENT && current
						? missionDescription(current, now)
						: i18n.t(`app:contest.missions.${seal.missionId}`)}
				value={sealLabel(seal)}
			/>)}
		</ExpandableList>
	</>;
}

/** The booklet itself: the trials already sealed, the one in progress, then the other missions of the day. */
export function ContestBooklet(): ReactNode {
	const view = useContest();
	const [now] = useState(Date.now);
	return <>
		<GuideTip text={i18n.t("app:contest.intro")} />
		{view ? view.contest.trials.map(trial => <TrialSection key={trial.id} trial={trial} current={view.contest.current?.mission ?? null} now={now} />) : null}
		<Missions campaign={false} />
	</>;
}

/** In a city the travel tools are out of reach: the guide names the contest step and opens what it needs. */
export function ContestCityTip({openMap}: {openMap: () => void}): ReactNode {
	const view = useContest();
	const router = useRouter();
	const mission = view?.running ? view.contest.current?.mission : undefined;
	if (!mission) return null;
	const action = mission.missionId === "chooseClass"
		? {label: i18n.t("app:contest.actions.chooseClass"), onPress: (): void => router.push("/arena/classes")}
		: mission.missionId === "commandMap"
			? {label: i18n.t("app:contest.actions.openMap"), onPress: openMap}
			: undefined;
	return <GuideTip text={i18n.t(`app:contest.hints.${mission.missionId}`)} {...action ? {action} : {}} testID="guide-tip-city" />;
}
