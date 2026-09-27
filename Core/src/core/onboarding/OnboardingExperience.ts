import Player from "../database/game/models/Player";
import { PlayerMissionsInfos } from "../database/game/models/PlayerMissionsInfo";
import {
	OnboardingConstants, OnboardingMissionId, ONBOARDING_TRIALS
} from "../../../../Lib/src/constants/OnboardingConstants";
import { currentOnboardingMission } from "./OnboardingSmallEvents";

const FIRST_TRIAL_MISSIONS: readonly OnboardingMissionId[] = ONBOARDING_TRIALS[0].missions;

/** Before the long road of the second trial, the reports only give a hint of experience, so the first levels come at a calmer pace. */
export async function reportExperience(player: Player, amount: number): Promise<number> {
	if (amount <= OnboardingConstants.FIRST_TRIAL_MAX_REPORT_EXPERIENCE) {
		return amount;
	}
	const mission = currentOnboardingMission(await PlayerMissionsInfos.getOfPlayer(player.id));
	return mission !== null && FIRST_TRIAL_MISSIONS.includes(mission)
		? OnboardingConstants.FIRST_TRIAL_MAX_REPORT_EXPERIENCE
		: amount;
}
