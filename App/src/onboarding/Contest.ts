import {useEffect} from "react";
import {MissionsRes} from "ws-packets/src/fromServer/missions/MissionsRes";
import {MISSION_TYPES} from "ws-packets/src/objects/Mission";
import {ONBOARDING_TRIALS, OnboardingTrialId} from "ws-packets/src/objects/Onboarding";
import {useMissions} from "@/src/components/Missions";
import {onboardingStore, ONBOARDING_MOMENTS} from "@/src/onboarding/OnboardingStore";

/** The contest covers the first campaign positions, 1-indexed like `campaignProgression`. */
export const CONTEST_LENGTH = ONBOARDING_TRIALS.reduce((length, trial) => length + trial.missions.length, 0);

/** Core sends 0 once the whole campaign is completed. */
const CAMPAIGN_COMPLETED = 0;

/** Where a newcomer stands in the royal contest, as the campaign draws it. */
export type ContestView = {
	running: boolean;

	/** The trial and campaign mission the player is on, while the contest runs. */
	trialId: OnboardingTrialId | null;
	missionId: string | null;
};

export function isContestRunning(progression: number): boolean {
	return progression !== CAMPAIGN_COMPLETED && progression <= CONTEST_LENGTH;
}

function trialAt(progression: number): OnboardingTrialId | null {
	let lastPosition = 0;
	return ONBOARDING_TRIALS.find(trial => {
		lastPosition += trial.missions.length;
		return progression <= lastPosition;
	})?.id ?? null;
}

export function contestOf(missions: Pick<MissionsRes, "campaignProgression" | "missions">): ContestView {
	if (!isContestRunning(missions.campaignProgression)) return {running: false, trialId: null, missionId: null};
	const mission = missions.missions.find(candidate => candidate.missionType === MISSION_TYPES.CAMPAIGN);
	return {running: true, trialId: trialAt(missions.campaignProgression), missionId: mission?.missionId ?? null};
}

/** The contest as the player's missions draw it, read without counting as consulting them. */
export function useContest(): ContestView | null {
	const missions = useMissions();
	const view = missions.status === "ready" ? contestOf(missions.data) : null;
	const running = view?.running ?? false;
	useEffect(() => {
		if (running) onboardingStore.mark(ONBOARDING_MOMENTS.CONTEST_JOINED);
	}, [running]);
	return view;
}
