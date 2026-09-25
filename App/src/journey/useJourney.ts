import {useEffect, useMemo, useSyncExternalStore} from "react";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {usePlayerHasNotStarted} from "@/src/store/usePlayerHasNotStarted";
import {
	JOURNEY_STEPS, JOURNEY_TABS, JourneyFeature, JourneyProgress, JourneyStep, JourneyTab, nextLevelStep, openTabs, unlockedFeatures
} from "@/src/journey/Journey";
import {journeyStore} from "@/src/journey/JourneyStore";

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

/** The character's progress as far as unlocking goes, kept stable while none of it changes. */
function useJourneyProgress(): {progress: JourneyProgress | null; account: string | null} {
	const profile = usePlayerProfile();
	const notStarted = usePlayerHasNotStarted();
	const data = profile.status === "ready" ? profile.data : null;
	const known = notStarted || data !== null;
	const level = data?.level ?? FIRST_LEVEL;
	const hasPet = data?.pet !== undefined;
	const hasGuild = data?.guild !== undefined;
	useEffect(() => {
		if (notStarted) journeyStore.markNewcomer();
	}, [notStarted]);
	const progress = useMemo(
		(): JourneyProgress | null => known ? {started: !notStarted, level, hasPet, hasGuild} : null,
		[known, notStarted, level, hasPet, hasGuild]
	);
	return {progress, account: data?.pseudo ?? null};
}

/** How far the character has come, which parts of the app it has opened, and what it has yet to be shown. */
export function useJourney(): Journey {
	const {progress, account} = useJourneyProgress();
	const record = useSyncExternalStore(journeyStore.subscribe, journeyStore.getSnapshot, journeyStore.getSnapshot);
	const unlocked = useMemo(() => progress ? unlockedFeatures(progress) : null, [progress]);
	const tabs = useMemo(() => unlocked ? openTabs(unlocked) : journeyStore.lastTabs() ?? [JOURNEY_TABS.ADVENTURE], [unlocked]);

	useEffect(() => {
		if (account && unlocked) journeyStore.load(account, unlocked);
	}, [account, unlocked]);
	useEffect(() => {
		if (unlocked) journeyStore.saveLastTabs(tabs);
	}, [unlocked, tabs]);

	const announced = record?.announced ?? [];
	const visited = record?.visited ?? [];
	return {
		progress,
		tabs,
		nextStep: progress ? nextLevelStep(progress) : null,
		unannounced: record && progress ? JOURNEY_STEPS.find(step => step.isUnlocked(progress) && !announced.includes(step.feature)) ?? null : null,
		isNew: tab => unlocked !== null && unlockedOn(tab, unlocked).some(feature => announced.includes(feature) && !visited.includes(feature)),
		announce: feature => journeyStore.announce(feature),
		visit: tab => {
			if (unlocked) journeyStore.visit(unlockedOn(tab, unlocked));
		}
	};
}
