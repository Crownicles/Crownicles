import {MissionsRes} from "ws-packets/src/fromServer/missions/MissionsRes";
import {Mission, MISSION_TYPES} from "ws-packets/src/objects/Mission";
import {ONBOARDING_TRIALS, OnboardingTrialId} from "ws-packets/src/objects/Onboarding";

/** Where a contest mission stands: sealed in the booklet, the one to do now, or still to discover. */
export const SEAL_STATES = {SEALED: "sealed", CURRENT: "current", AHEAD: "ahead"} as const;
export type SealState = typeof SEAL_STATES[keyof typeof SEAL_STATES];

export type ContestSeal = {missionId: string; position: number; state: SealState};
export type ContestTrial = {id: OnboardingTrialId; number: number; seals: ContestSeal[]; state: SealState};

export type Contest = {
	trials: ContestTrial[];

	/** The trial and campaign mission the player is on; null once every seal is set. */
	current: {trial: ContestTrial; mission: Mission} | null;
};

/** The contest covers the first campaign positions, 1-indexed like `campaignProgression`. */
export const CONTEST_LENGTH = ONBOARDING_TRIALS.reduce((length, trial) => length + trial.missions.length, 0);

/** Core sends 0 once the whole campaign is completed. */
const CAMPAIGN_COMPLETED = 0;

function sealState(position: number, progression: number): SealState {
	if (progression === CAMPAIGN_COMPLETED || position < progression) return SEAL_STATES.SEALED;
	return position === progression ? SEAL_STATES.CURRENT : SEAL_STATES.AHEAD;
}

function trialState(seals: readonly ContestSeal[]): SealState {
	if (seals.every(seal => seal.state === SEAL_STATES.SEALED)) return SEAL_STATES.SEALED;
	return seals.some(seal => seal.state !== SEAL_STATES.AHEAD) ? SEAL_STATES.CURRENT : SEAL_STATES.AHEAD;
}

export function isContestRunning(progression: number): boolean {
	return progression !== CAMPAIGN_COMPLETED && progression <= CONTEST_LENGTH;
}

/** The booklet as the missions draw it: which seals are set, and what the player does next. */
export function contestOf(missions: Pick<MissionsRes, "campaignProgression" | "missions">): Contest {
	const progression = missions.campaignProgression;
	let position = 0;
	const trials = ONBOARDING_TRIALS.map((trial, index): ContestTrial => {
		const seals = trial.missions.map((missionId): ContestSeal => {
			position++;
			return {missionId, position, state: sealState(position, progression)};
		});
		return {id: trial.id, number: index + 1, seals, state: trialState(seals)};
	});
	const trial = trials.find(candidate => candidate.state === SEAL_STATES.CURRENT);
	const mission = missions.missions.find(candidate => candidate.missionType === MISSION_TYPES.CAMPAIGN);
	return {trials, current: isContestRunning(progression) && trial && mission ? {trial, mission} : null};
}

export function sealedCount(contest: Contest): number {
	return contest.trials.flatMap(trial => trial.seals).filter(seal => seal.state === SEAL_STATES.SEALED).length;
}
