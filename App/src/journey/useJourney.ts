import {useEffect, useMemo} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {refusedAsNotStarted, usePlayerHasNotStarted} from "@/src/store/usePlayerHasNotStarted";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {
	isInventoryTaught, JOURNEY_STEPS, JOURNEY_TABS, JourneyFeature, JourneyProgress, JourneyStep, JourneyTab, nextLevelStep, openTabs, unlockedFeatures
} from "@/src/journey/Journey";
import {useMissions} from "@/src/components/Missions";
import {announcedFlag, firstRecord, journeyRecordOf, journeyStore, JourneyRecord, visitedFlag} from "@/src/journey/JourneyStore";
import {AppStateChange, useAppState, useAppStateChange} from "@/src/store/AppState";

export type Journey = {

	/** Unknown while the profile is loading or unreachable. */
	progress: JourneyProgress | null;
	tabs: readonly JourneyTab[];

	/** The next unlock still waiting for a level; while there is one, the player is still a newcomer. Never shown to them. */
	nextStep: JourneyStep & {level: number} | null;

	/** The first unlock the player has not been shown yet. */
	unannounced: JourneyStep | null;
	isNew: (tab: JourneyTab) => boolean;
	announce: (feature: JourneyFeature) => void;
	visit: (tab: JourneyTab) => void;
};

const FIRST_LEVEL = 1;

function unlockedOn(tab: JourneyTab, unlocked: readonly JourneyFeature[]): JourneyFeature[] {
	return JOURNEY_STEPS.filter(step => step.tab === tab && unlocked.includes(step.feature)).map(step => step.feature);
}

type ProfileFacts = {level: number; hasPet: boolean; hasGuild: boolean};

function profileFacts(data: ProfileRes | null): ProfileFacts {
	if (!data) return {level: FIRST_LEVEL, hasPet: false, hasGuild: false};
	return {level: data.level, hasPet: data.pet !== undefined, hasGuild: data.guild !== undefined};
}

function firstUnannounced(progress: JourneyProgress | null, record: JourneyRecord | null): JourneyStep | null {
	if (!progress || !record) return null;
	return JOURNEY_STEPS.find(step => step.isUnlocked(progress) && !record.announced.includes(step.feature)) ?? null;
}

/** A tab is new while something announced on it has not been visited yet. */
function hasUnvisitedUnlock(tab: JourneyTab, unlocked: readonly JourneyFeature[] | null, record: JourneyRecord | null): boolean {
	if (!unlocked || !record) return false;
	return unlockedOn(tab, unlocked).some(feature => record.announced.includes(feature) && !record.visited.includes(feature));
}

type MissionsFacts = {known: boolean; inventoryTaught: boolean};

/** What the campaign says of the unlocks; an answer refused before the departure is asked again. */
function useMissionsFacts(notStarted: boolean): MissionsFacts {
	const queryClient = useQueryClient();
	const missions = useMissions();
	// Refused before the departure: that answer says nothing of the campaign now under way.
	const outdated = !notStarted && refusedAsNotStarted(missions);
	useEffect(() => {
		if (outdated) queryClient.resetQueries({queryKey: gameKey(GAME_ENTITIES.MISSIONS)}).catch(console.error);
	}, [outdated, queryClient]);
	return {
		known: missions.status !== "loading" && !outdated,
		// Without the missions, a veteran keeps the profile rather than lose it on a failed request.
		inventoryTaught: missions.status !== "ready" || isInventoryTaught(missions.data.campaignProgression)
	};
}

function isProgressKnown(notStarted: boolean, profileKnown: boolean, missionsKnown: boolean): boolean {
	if (notStarted) return true;
	return profileKnown && missionsKnown;
}

/** The character's progress as far as unlocking goes, kept stable while none of it changes. */
function useJourneyProgress(): JourneyProgress | null {
	const profile = usePlayerProfile();
	const notStarted = usePlayerHasNotStarted();
	const missions = useMissionsFacts(notStarted);
	const data = profile.status === "ready" ? profile.data : null;
	const known = isProgressKnown(notStarted, data !== null, missions.known);
	const {inventoryTaught} = missions;
	const {level, hasPet, hasGuild} = profileFacts(data);
	useEffect(() => {
		if (notStarted) journeyStore.markNewcomer();
	}, [notStarted]);
	return useMemo(
		(): JourneyProgress | null => (known ? {started: !notStarted, level, hasPet, hasGuild, inventoryTaught} : null),
		[known, notStarted, level, hasPet, hasGuild, inventoryTaught]
	);
}

/** The record Core keeps, written once for a character the app meets for the first time. */
function useJourneyRecord(unlocked: readonly JourneyFeature[] | null): {record: JourneyRecord | null; change: (change: AppStateChange) => void} {
	const state = useAppState();
	const change = useAppStateChange();
	const seen = state.status === "ready" ? state.data.seen : null;
	const record = useMemo(() => (seen ? journeyRecordOf(seen) : null), [seen]);
	const toWrite = seen !== null && record === null && unlocked !== null;
	useEffect(() => {
		if (toWrite && unlocked) change({seen: firstRecord(journeyStore.isNewcomer(), unlocked)});
	}, [toWrite, unlocked, change]);
	return {record, change};
}

function unvisitedOn(tab: JourneyTab, unlocked: readonly JourneyFeature[] | null, record: JourneyRecord | null): JourneyFeature[] {
	if (!unlocked || !record) return [];
	return unlockedOn(tab, unlocked).filter(feature => !record.visited.includes(feature));
}

/** What the player is shown and opens goes to Core, which keeps the record. */
function recordUpdates(record: JourneyRecord | null, unlocked: readonly JourneyFeature[] | null, change: (change: AppStateChange) => void): Pick<Journey, "announce" | "visit"> {
	return {
		announce: feature => {
			if (record && !record.announced.includes(feature)) change({seen: [announcedFlag(feature)]});
		},
		visit: tab => {
			const features = unvisitedOn(tab, unlocked, record);
			if (features.length > 0) change({seen: features.flatMap(feature => [announcedFlag(feature), visitedFlag(feature)])});
		}
	};
}

/** How far the character has come, which parts of the app it has opened, and what it has yet to be shown. */
export function useJourney(): Journey {
	const progress = useJourneyProgress();
	const unlocked = useMemo(() => (progress ? unlockedFeatures(progress) : null), [progress]);
	const {record, change} = useJourneyRecord(unlocked);
	const tabs = useMemo(() => (unlocked ? openTabs(unlocked) : journeyStore.lastTabs() ?? [JOURNEY_TABS.ADVENTURE]), [unlocked]);

	useEffect(() => {
		if (unlocked) journeyStore.saveLastTabs(tabs);
	}, [unlocked, tabs]);

	return {
		progress,
		tabs,
		nextStep: progress ? nextLevelStep(progress) : null,
		unannounced: firstUnannounced(progress, record),
		isNew: tab => hasUnvisitedUnlock(tab, unlocked, record),
		...recordUpdates(record, unlocked, change)
	};
}
