import { PlayerMissionsInfo } from "../database/game/models/PlayerMissionsInfo";
import { currentOnboardingMission } from "./OnboardingSmallEvents";

/** A newcomer never meets the token merchant: the way to spend tokens only shows once they hold enough. */
export function hidesTokenOffer(missionInfo: PlayerMissionsInfo, canAfford: boolean): boolean {
	return !canAfford && currentOnboardingMission(missionInfo) !== null;
}
